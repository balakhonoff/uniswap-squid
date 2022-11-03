import {BigDecimal} from '@subsquid/big-decimal'
import {
    assertNotNull,
    BatchBlock,
    BlockHandlerContext,
    CommonHandlerContext,
    EvmBlock,
    LogHandlerContext,
} from '@subsquid/evm-processor'
import {Store} from '@subsquid/typeorm-store'
import {
    Pool,
    Token,
    Bundle,
    Factory,
    Mint,
    Tick,
    Burn,
    Swap,
    Transaction,
    UniswapDayData,
    PoolDayData,
    PoolHourData,
    TokenHourData,
    TokenDayData,
    TickDayData,
} from '../model'
import {safeDiv} from '../utils'
import {FACTORY_ADDRESS, MULTICALL_ADDRESS} from '../utils/constants'
import {
    createPoolDayData,
    createPoolHourData,
    snapshotId,
    createTickDayData,
    createTokenDayData,
    createTokenHourData,
    createUniswapDayData,
    getDayIndex,
    getHourIndex,
} from '../utils/intervalUpdates'
import {
    getTrackedAmountUSD,
    sqrtPriceX96ToTokenPrices,
    USDC_WETH_03_POOL,
    WETH_ADDRESS,
    MINIMUM_ETH_LOCKED,
    STABLE_COINS,
} from '../utils/pricing'
import {createTick, feeTierToTickSpacing} from '../utils/tick'
import * as poolAbi from '../abi/pool'
import {MappingProcessor} from './mappingProcessor'
import {LogItem, TransactionItem} from '@subsquid/evm-processor/lib/interfaces/dataSelection'
import {BlockMap} from '../utils/blockMap'
import {last} from '../utils/tools'

type EventData =
    | (InitializeData & {type: 'Initialize'})
    | (MintData & {type: 'Mint'})
    | (BurnData & {type: 'Burn'})
    | (SwapData & {type: 'Swap'})

export class PairsProcessor extends MappingProcessor<Item> {
    constructor(ctx: CommonHandlerContext<Store>) {
        super(ctx)
    }

    async run(blocks: BatchBlock<Item>[]): Promise<void> {
        const eventsData = this.processItems(blocks)
        if (eventsData.size == 0) return

        await this.prefetch(eventsData)

        const bundle = await this.getBundle()
        const factory = await this.getFactory()

        for (const [block, blockEventsData] of eventsData) {
            for (const data of blockEventsData) {
                switch (data.type) {
                    case 'Initialize':
                        await this.processInitializeData(block, data)
                        break
                    case 'Mint':
                        await this.processMintData(block, data)
                        break
                    case 'Burn':
                        await this.processBurnData(block, data)
                        break
                    case 'Swap':
                        await this.processSwapData(block, data)
                        break
                }
            }
        }

        await Promise.all([
            updatePoolFeeVars(this.createContext(last(blocks).header), this.entities.values(Pool)),
            updateTickFeeVars(this.createContext(last(blocks).header), this.entities.values(Tick)),
        ])

        await this.ctx.store.save(bundle)
        await this.ctx.store.save(factory)
        await this.ctx.store.save(this.entities.values(Token))
        await this.ctx.store.save(this.entities.values(Pool))
        await this.ctx.store.save(this.entities.values(Tick))
        await this.ctx.store.insert(this.entities.values(Transaction))
        await this.ctx.store.insert(this.entities.values(Mint))
        await this.ctx.store.insert(this.entities.values(Burn))
        await this.ctx.store.insert(this.entities.values(Swap))
        await this.ctx.store.save(this.entities.values(UniswapDayData))
        await this.ctx.store.save(this.entities.values(PoolDayData))
        await this.ctx.store.save(this.entities.values(PoolHourData))
        await this.ctx.store.save(this.entities.values(TokenDayData))
        await this.ctx.store.save(this.entities.values(TokenHourData))
        await this.ctx.store.save(this.entities.values(TickDayData))
    }

    private async prefetch(eventsData: BlockMap<EventData>) {
        const dayIds = new Set<number>()
        const hoursIds = new Set<number>()

        for (const [block, blockEventsData] of eventsData) {
            for (const data of blockEventsData) {
                switch (data.type) {
                    case 'Initialize':
                        this.entities.defer(Tick, tickId(data.poolId, data.tick))
                        this.entities.defer(Pool, data.poolId)
                        break
                    case 'Mint':
                        this.entities.defer(Pool, data.poolId)
                        this.entities.defer(
                            Tick,
                            tickId(data.poolId, data.tickLower),
                            tickId(data.poolId, data.tickUpper)
                        )
                        break
                    case 'Burn':
                        this.entities.defer(Pool, data.poolId)
                        this.entities.defer(
                            Tick,
                            tickId(data.poolId, data.tickLower),
                            tickId(data.poolId, data.tickUpper)
                        )
                        break
                    case 'Swap':
                        this.entities.defer(Tick, tickId(data.poolId, data.tick))
                        this.entities.defer(Pool, data.poolId)
                        break
                }
            }
            dayIds.add(getDayIndex(block.timestamp))
            hoursIds.add(getHourIndex(block.timestamp))
        }

        let pools = await this.entities.load(Pool)

        const poolsTicksIds = collectTicksFromPools(pools.values())
        let ticks = await this.entities.defer(Tick, ...poolsTicksIds).load(Tick)

        const tokenIds = collectTokensFromPools(pools.values())
        let tokens = await this.entities.defer(Token, ...tokenIds).load(Token)

        const whiteListPoolsIds = collectWhiteListPoolsFromTokens(tokens.values())
        pools = await this.entities.defer(Pool, ...whiteListPoolsIds).load(Pool)

        const whiteListPoolsTokenIds = collectTokensFromPools(pools.values())
        tokens = await this.entities.defer(Token, ...whiteListPoolsTokenIds).load(Token)

        for (const index of dayIds) {
            this.entities.defer(UniswapDayData, snapshotId(FACTORY_ADDRESS, index))

            for (const id of pools.keys()) {
                this.entities.defer(PoolDayData, snapshotId(id, index))
            }

            for (const id of tokens.keys()) {
                this.entities.defer(TokenDayData, snapshotId(id, index))
            }

            for (const id of ticks.keys()) {
                this.entities.defer(TickDayData, snapshotId(id, index))
            }
        }

        for (const index of hoursIds) {
            for (const id of pools.keys()) {
                this.entities.defer(PoolHourData, snapshotId(id, index))
            }

            for (const id of tokens.keys()) {
                this.entities.defer(PoolHourData, snapshotId(id, index))
            }
        }

        await this.entities.load(Pool)
        await this.entities.load(Token)
        await this.entities.load(Tick)
        await this.entities.load(UniswapDayData)
        await this.entities.load(PoolDayData)
        await this.entities.load(TokenDayData)
        await this.entities.load(TickDayData)
        await this.entities.load(PoolHourData)
        await this.entities.load(TokenHourData)
    }

    private processItems(blocks: BatchBlock<Item>[]) {
        let eventsData = new BlockMap<EventData>()

        this.processItem(blocks, (block, item) => {
            if (item.kind !== 'evmLog') return
            switch (item.evmLog.topics[0]) {
                case poolAbi.events['Initialize(uint160,int24)'].topic: {
                    const data = processInitialize({...this.createContext(block), ...item})
                    eventsData.push(block, {
                        type: 'Initialize',
                        ...data,
                    })
                    return
                }
                case poolAbi.events['Mint(address,address,int24,int24,uint128,uint256,uint256)'].topic: {
                    const data = processMint({...this.createContext(block), ...item})
                    eventsData.push(block, {
                        type: 'Mint',
                        ...data,
                    })
                    return
                }
                case poolAbi.events['Burn(address,int24,int24,uint128,uint256,uint256)'].topic: {
                    const data = processBurn({...this.createContext(block), ...item})
                    eventsData.push(block, {
                        type: 'Burn',
                        ...data,
                    })
                    return
                }
                case poolAbi.events['Swap(address,address,int256,int256,uint160,uint128,int24)'].topic: {
                    const data = processSwap({...this.createContext(block), ...item})
                    eventsData.push(block, {
                        type: 'Swap',
                        ...data,
                    })
                    return
                }
            }
        })

        return eventsData
    }

    private async processInitializeData(block: EvmBlock, data: InitializeData) {
        const bundle = await this.getBundle()

        let pool = this.entities.get(Pool, data.poolId, false)
        if (pool == null) return

        let token0 = await this.entities.getOrFail(Token, pool.token0Id)
        let token1 = await this.entities.getOrFail(Token, pool.token1Id)

        // update pool sqrt price and tick
        pool.sqrtPrice = data.sqrtPrice
        pool.tick = data.tick

        // update token prices
        token0.derivedETH = await this.getEthPerToken(token0.id)
        token1.derivedETH = await this.getEthPerToken(token1.id)

        const usdcPool = await this.entities.get(Pool, USDC_WETH_03_POOL)
        bundle.ethPriceUSD = usdcPool?.token0Price || 0

        await this.updatePoolDayData(block, pool.id)
        await this.updatePoolHourData(block, pool.id)
        await this.updateTokenDayData(block, token0.id)
        await this.updateTokenHourData(block, token0.id)
        await this.updateTokenDayData(block, token1.id)
        await this.updateTokenHourData(block, token1.id)
    }

    private async processMintData(block: EvmBlock, data: MintData) {
        const bundle = await this.getBundle()
        let factory = await this.getFactory()

        let pool = this.entities.get(Pool, data.poolId, false)
        if (pool == null) return

        let token0 = await this.entities.getOrFail(Token, pool.token0Id)
        let token1 = await this.entities.getOrFail(Token, pool.token1Id)

        let amount0 = BigDecimal(data.amount0, token0.decimals).toNumber()
        let amount1 = BigDecimal(data.amount1, token1.decimals).toNumber()

        let amountUSD =
            amount0 * (token0.derivedETH * bundle.ethPriceUSD) + amount1 * (token1.derivedETH * bundle.ethPriceUSD)

        // reset tvl aggregates until new amounts calculated
        factory.totalValueLockedETH = factory.totalValueLockedETH - pool.totalValueLockedETH

        // update globals
        factory.txCount++

        // update token0 data
        token0.txCount++
        token0.totalValueLocked = token0.totalValueLocked + amount0
        token0.totalValueLockedUSD = token0.totalValueLocked * (token0.derivedETH * bundle.ethPriceUSD)

        // update token1 data
        token1.txCount++
        token1.totalValueLocked = token1.totalValueLocked + amount1
        token1.totalValueLockedUSD = token1.totalValueLocked * (token1.derivedETH * bundle.ethPriceUSD)

        // pool data
        pool.txCount++

        // Pools liquidity tracks the currently active liquidity given pools current tick.
        // We only want to update it on mint if the new position includes the current tick.
        if (pool.tick != null && data.tickLower <= pool.tick && data.tickUpper > pool.tick) {
            pool.liquidity += data.amount
        }

        pool.totalValueLockedToken0 = pool.totalValueLockedToken0 + amount0
        pool.totalValueLockedToken1 = pool.totalValueLockedToken1 + amount1
        pool.totalValueLockedETH =
            pool.totalValueLockedToken0 * token0.derivedETH + pool.totalValueLockedToken1 * token1.derivedETH
        pool.totalValueLockedUSD = pool.totalValueLockedETH * bundle.ethPriceUSD

        // reset aggregates with new amounts
        factory.totalValueLockedETH = factory.totalValueLockedETH + pool.totalValueLockedETH
        factory.totalValueLockedUSD = factory.totalValueLockedETH * bundle.ethPriceUSD

        let transaction = this.entities.get(Transaction, data.transaction.hash, false)
        if (!transaction) {
            transaction = createTransaction(block, data.transaction)
            this.entities.add(transaction)
        }

        this.entities.add(
            new Mint({
                id: `${pool.id}#${pool.txCount}`,
                transactionId: transaction.id,
                timestamp: transaction.timestamp,
                poolId: pool.id,
                token0Id: pool.token0Id,
                token1Id: pool.token1Id,
                owner: data.owner,
                sender: data.sender,
                origin: data.transaction.from,
                amount: data.amount,
                amount0,
                amount1,
                amountUSD,
                tickLower: data.tickLower,
                tickUpper: data.tickUpper,
                logIndex: data.logIndex,
            })
        )

        // tick entities
        let lowerTickId = tickId(pool.id, data.tickLower)
        let lowerTick = this.entities.get(Tick, lowerTickId, false)
        if (lowerTick == null) {
            lowerTick = createTick(lowerTickId, data.tickLower, pool.id)
            lowerTick.createdAtBlockNumber = block.height
            lowerTick.createdAtTimestamp = new Date(block.timestamp)
            this.entities.add(lowerTick)
        }

        let upperTickId = tickId(pool.id, data.tickUpper)
        let upperTick = this.entities.get(Tick, upperTickId, false)
        if (upperTick == null) {
            upperTick = createTick(upperTickId, data.tickUpper, pool.id)
            upperTick.createdAtBlockNumber = block.height
            upperTick.createdAtTimestamp = new Date(block.timestamp)
            this.entities.add(upperTick)
        }

        lowerTick.liquidityGross += data.amount
        lowerTick.liquidityNet += data.amount

        upperTick.liquidityGross += data.amount
        upperTick.liquidityNet -= data.amount

        // TODO: Update Tick's volume, fees, and liquidity provider count. Computing these on the tick
        // level requires reimplementing some of the swapping code from v3-core.

        await this.updateUniswapDayData(block)
        await this.updatePoolDayData(block, pool.id)
        await this.updatePoolHourData(block, pool.id)
        await this.updateTokenDayData(block, token0.id)
        await this.updateTokenHourData(block, token0.id)
        await this.updateTokenDayData(block, token1.id)
        await this.updateTokenHourData(block, token1.id)
        // await updateTickFeeVarsAndSave(lowerTick!, event)
        // await updateTickFeeVarsAndSave(upperTick!, event)
    }

    private async processBurnData(block: EvmBlock, data: BurnData) {
        const bundle = await this.getBundle()
        let factory = await this.getFactory()

        let pool = this.entities.get(Pool, data.poolId, false)
        if (pool == null) return

        let token0 = await this.entities.getOrFail(Token, pool.token0Id)
        let token1 = await this.entities.getOrFail(Token, pool.token1Id)

        let amount0 = BigDecimal(data.amount0, token0.decimals).toNumber()
        let amount1 = BigDecimal(data.amount1, token1.decimals).toNumber()

        let amountUSD =
            amount0 * (token0.derivedETH * bundle.ethPriceUSD) + amount1 * (token1.derivedETH * bundle.ethPriceUSD)

        // reset tvl aggregates until new amounts calculated
        factory.totalValueLockedETH = factory.totalValueLockedETH - pool.totalValueLockedETH

        // update globals
        factory.txCount++

        // update token0 data
        token0.txCount++
        token0.totalValueLocked = token0.totalValueLocked - amount0
        token0.totalValueLockedUSD = token0.totalValueLocked * (token0.derivedETH * bundle.ethPriceUSD)

        // update token1 data
        token1.txCount++
        token1.totalValueLocked = token1.totalValueLocked - amount1
        token1.totalValueLockedUSD = token1.totalValueLocked * (token1.derivedETH * bundle.ethPriceUSD)

        // pool data
        pool.txCount++
        // Pools liquidity tracks the currently active liquidity given pools current tick.
        // We only want to update it on burn if the position being burnt includes the current tick.
        if (pool.tick != null && data.tickLower <= pool.tick && data.tickUpper > pool.tick) {
            pool.liquidity -= data.amount
        }

        pool.totalValueLockedToken0 = pool.totalValueLockedToken0 - amount0
        pool.totalValueLockedToken1 = pool.totalValueLockedToken1 - amount1
        pool.totalValueLockedETH =
            pool.totalValueLockedToken0 * token0.derivedETH + pool.totalValueLockedToken1 * token1.derivedETH
        pool.totalValueLockedUSD = pool.totalValueLockedETH * bundle.ethPriceUSD

        // reset aggregates with new amounts
        factory.totalValueLockedETH = factory.totalValueLockedETH + pool.totalValueLockedETH
        factory.totalValueLockedUSD = factory.totalValueLockedETH * bundle.ethPriceUSD

        // burn entity
        let transaction = this.entities.get(Transaction, data.transaction.hash, false)
        if (!transaction) {
            transaction = createTransaction(block, data.transaction)
            this.entities.add(transaction)
        }

        this.entities.add(
            new Burn({
                id: `${pool.id}#${pool.txCount}`,
                transactionId: transaction.id,
                timestamp: new Date(block.timestamp),
                poolId: pool.id,
                token0Id: pool.token0Id,
                token1Id: pool.token1Id,
                owner: data.owner,
                origin: data.transaction.from,
                amount: data.amount,
                amount0,
                amount1,
                amountUSD,
                tickLower: data.tickLower,
                tickUpper: data.tickUpper,
                logIndex: data.logIndex,
            })
        )

        // tick entities
        let lowerTickId = tickId(pool.id, data.tickLower)
        const lowerTick = await this.entities.get(Tick, lowerTickId)

        let upperTickId = tickId(pool.id, data.tickUpper)
        const upperTick = await this.entities.get(Tick, upperTickId)

        if (lowerTick) {
            lowerTick.liquidityGross -= data.amount
            lowerTick.liquidityNet -= data.amount
        }

        if (upperTick) {
            upperTick.liquidityGross -= data.amount
            upperTick.liquidityNet += data.amount
        }

        await this.updateUniswapDayData(block)
        await this.updatePoolDayData(block, pool.id)
        await this.updatePoolHourData(block, pool.id)
        await this.updateTokenDayData(block, token0.id)
        await this.updateTokenHourData(block, token0.id)
        await this.updateTokenDayData(block, token1.id)
        await this.updateTokenHourData(block, token1.id)
        // updateTickFeeVarsAndSave(lowerTick!, event)
        // updateTickFeeVarsAndSave(upperTick!, event)
    }

    private async processSwapData(block: EvmBlock, data: SwapData) {
        if (data.poolId == '0x9663f2ca0454accad3e094448ea6f77443880454') return

        const bundle = await this.getBundle()
        let factory = await this.getFactory()

        let pool = this.entities.get(Pool, data.poolId, false)
        if (pool == null) return

        let token0 = await this.entities.getOrFail(Token, pool.token0Id)
        let token1 = await this.entities.getOrFail(Token, pool.token1Id)

        let amount0 = BigDecimal(data.amount0, token0.decimals).toNumber()
        let amount1 = BigDecimal(data.amount1, token1.decimals).toNumber()

        let oldTick = pool.tick || 0

        // need absolute amounts for volume
        let amount0Abs = Math.abs(amount0)
        let amount1Abs = Math.abs(amount1)

        let amount0ETH = amount0Abs * token0.derivedETH
        let amount1ETH = amount1Abs * token1.derivedETH
        let amount0USD = amount0ETH * bundle.ethPriceUSD
        let amount1USD = amount1ETH * bundle.ethPriceUSD

        // get amount that should be tracked only - div 2 because cant count both input and output as volume
        let amountTotalUSDTracked = getTrackedAmountUSD(token0.id, amount0USD, token1.id, amount1USD)
        let amountTotalETHTracked = safeDiv(amountTotalUSDTracked, bundle.ethPriceUSD)
        let amountTotalUSDUntracked = (amount0USD + amount1USD) / 2

        let feesETH = (amountTotalETHTracked * pool.feeTier) / 1000000
        let feesUSD = (amountTotalUSDTracked * pool.feeTier) / 1000000

        // global updates
        factory.txCount++
        factory.totalVolumeETH = factory.totalVolumeETH + amountTotalETHTracked
        factory.totalVolumeUSD = factory.totalVolumeUSD + amountTotalUSDTracked
        factory.untrackedVolumeUSD = factory.untrackedVolumeUSD + amountTotalUSDUntracked
        factory.totalFeesETH = factory.totalFeesETH + feesETH
        factory.totalFeesUSD = factory.totalFeesUSD + feesUSD

        // reset aggregate tvl before individual pool tvl updates
        let currentPoolTvlETH = pool.totalValueLockedETH
        factory.totalValueLockedETH = factory.totalValueLockedETH - currentPoolTvlETH

        // pool volume
        pool.txCount++
        pool.volumeToken0 = pool.volumeToken0 + amount0Abs
        pool.volumeToken1 = pool.volumeToken1 + amount1Abs
        pool.volumeUSD = pool.volumeUSD + amountTotalUSDTracked
        pool.untrackedVolumeUSD = pool.untrackedVolumeUSD + amountTotalUSDUntracked
        pool.feesUSD = pool.feesUSD + feesUSD

        // Update the pool with the new active liquidity, price, and tick.
        pool.liquidity = data.liquidity
        pool.tick = data.tick
        pool.sqrtPrice = data.sqrtPrice
        pool.totalValueLockedToken0 = pool.totalValueLockedToken0 + amount0
        pool.totalValueLockedToken1 = pool.totalValueLockedToken1 + amount1

        // update token0 data
        token0.txCount++
        token0.volume = token0.volume + amount0Abs
        token0.totalValueLocked = token0.totalValueLocked + amount0
        token0.volumeUSD = token0.volumeUSD + amountTotalUSDTracked
        token0.untrackedVolumeUSD = token0.untrackedVolumeUSD + amountTotalUSDUntracked
        token0.feesUSD = token0.feesUSD + feesUSD

        // update token1 data
        token1.txCount++
        token1.volume = token1.volume + amount1Abs
        token1.totalValueLocked = token1.totalValueLocked + amount1
        token1.volumeUSD = token1.volumeUSD + amountTotalUSDTracked
        token1.untrackedVolumeUSD = token1.untrackedVolumeUSD + amountTotalUSDUntracked
        token1.feesUSD = token1.feesUSD + feesUSD

        // updated pool ratess
        let prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0.decimals, token1.decimals)
        pool.token0Price = prices[0]
        pool.token1Price = prices[1]

        // update USD pricing
        token0.derivedETH = await this.getEthPerToken(token0.id)
        token1.derivedETH = await this.getEthPerToken(token1.id)

        const usdcPool = await this.entities.get(Pool, USDC_WETH_03_POOL)
        bundle.ethPriceUSD = usdcPool?.token0Price || 0

        // Things afffected by new USD rates
        pool.totalValueLockedETH =
            pool.totalValueLockedToken0 * token0.derivedETH + pool.totalValueLockedToken1 * token1.derivedETH
        pool.totalValueLockedUSD = pool.totalValueLockedETH * bundle.ethPriceUSD

        factory.totalValueLockedETH = factory.totalValueLockedETH + pool.totalValueLockedETH
        factory.totalValueLockedUSD = factory.totalValueLockedETH * bundle.ethPriceUSD

        token0.totalValueLockedUSD = token0.totalValueLocked * token0.derivedETH * bundle.ethPriceUSD
        token1.totalValueLockedUSD = token1.totalValueLocked * token1.derivedETH * bundle.ethPriceUSD

        // create Swap event
        let transaction = this.entities.get(Transaction, data.transaction.hash, false)
        if (!transaction) {
            transaction = createTransaction(block, data.transaction)
            this.entities.add(transaction)
        }

        let swap = new Swap({id: pool.id + '#' + pool.txCount.toString()})
        swap.transactionId = transaction.id
        swap.timestamp = transaction.timestamp
        swap.poolId = pool.id
        swap.token0Id = pool.token0Id
        swap.token1Id = pool.token1Id
        swap.sender = data.sender
        swap.origin = data.transaction.from
        swap.recipient = data.recipient
        swap.amount0 = amount0
        swap.amount1 = amount1
        swap.amountUSD = amountTotalUSDTracked
        swap.tick = data.tick
        swap.sqrtPriceX96 = data.sqrtPrice
        swap.logIndex = data.logIndex
        this.entities.add(swap)

        // // interval data
        let uniswapDayData = await this.updateUniswapDayData(block)
        let poolDayData = await this.updatePoolDayData(block, pool.id)
        let poolHourData = await this.updatePoolHourData(block, pool.id)
        let token0DayData = await this.updateTokenDayData(block, token0.id)
        let token1DayData = await this.updateTokenHourData(block, token0.id)
        let token0HourData = await this.updateTokenDayData(block, token1.id)
        let token1HourData = await this.updateTokenHourData(block, token1.id)

        // // update volume metrics
        uniswapDayData.volumeETH = uniswapDayData.volumeETH + amountTotalETHTracked
        uniswapDayData.volumeUSD = uniswapDayData.volumeUSD + amountTotalUSDTracked
        uniswapDayData.feesUSD = uniswapDayData.feesUSD + feesUSD

        poolDayData.volumeUSD = poolDayData.volumeUSD + amountTotalUSDTracked
        poolDayData.volumeToken0 = poolDayData.volumeToken0 + amount0Abs
        poolDayData.volumeToken1 = poolDayData.volumeToken1 + amount1Abs
        poolDayData.feesUSD = poolDayData.feesUSD + feesUSD

        poolHourData.volumeUSD = poolHourData.volumeUSD + amountTotalUSDTracked
        poolHourData.volumeToken0 = poolHourData.volumeToken0 + amount0Abs
        poolHourData.volumeToken1 = poolHourData.volumeToken1 + amount1Abs
        poolHourData.feesUSD = poolHourData.feesUSD + feesUSD

        token0DayData.volume = token0DayData.volume + amount0Abs
        token0DayData.volumeUSD = token0DayData.volumeUSD + amountTotalUSDTracked
        token0DayData.untrackedVolumeUSD = token0DayData.untrackedVolumeUSD + amountTotalUSDTracked
        token0DayData.feesUSD = token0DayData.feesUSD + feesUSD

        token0HourData.volume = token0HourData.volume + amount0Abs
        token0HourData.volumeUSD = token0HourData.volumeUSD + amountTotalUSDTracked
        token0HourData.untrackedVolumeUSD = token0HourData.untrackedVolumeUSD + amountTotalUSDTracked
        token0HourData.feesUSD = token0HourData.feesUSD + feesUSD

        token1DayData.volume = token1DayData.volume + amount1Abs
        token1DayData.volumeUSD = token1DayData.volumeUSD + amountTotalUSDTracked
        token1DayData.untrackedVolumeUSD = token1DayData.untrackedVolumeUSD + amountTotalUSDTracked
        token1DayData.feesUSD = token1DayData.feesUSD + feesUSD

        token1HourData.volume = token1HourData.volume + amount1Abs
        token1HourData.volumeUSD = token1HourData.volumeUSD + amountTotalUSDTracked
        token1HourData.untrackedVolumeUSD = token1HourData.untrackedVolumeUSD + amountTotalUSDTracked
        token1HourData.feesUSD = token1HourData.feesUSD + feesUSD

        // Update inner vars of current or crossed ticks
        let newTick = pool.tick
        let tickSpacing = feeTierToTickSpacing(pool.feeTier)
        let modulo = Math.floor(newTick / tickSpacing)
        if (modulo == 0) {
            let tick = createTick(tickId(pool.id, newTick), newTick, pool.id)
            tick.createdAtBlockNumber = block.height
            tick.createdAtTimestamp = new Date(block.timestamp)
            this.entities.add(tick)
        }
    }

    private async getBundle() {
        return this.entities.getOrFail(Bundle, '1')
    }

    private async getFactory() {
        return this.entities.getOrFail(Factory, FACTORY_ADDRESS)
    }

    private async getEthPerToken(tokenId: string): Promise<number> {
        if (tokenId == WETH_ADDRESS) return 1

        // for now just take USD from pool with greatest TVL
        // need to update this to actually detect best rate based on liquidity distribution
        let largestLiquidityETH = MINIMUM_ETH_LOCKED
        let priceSoFar = 0

        const bundle = await this.getBundle()

        // hardcoded fix for incorrect rates
        // if whitelist includes token - get the safe price
        if (STABLE_COINS.includes(tokenId)) {
            priceSoFar = safeDiv(1, bundle.ethPriceUSD)
        } else {
            const token = await this.entities.getOrFail(Token, tokenId)
            for (const poolAddress of token.whitelistPools) {
                let pool = await this.entities.getOrFail(Pool, poolAddress)
                if (pool.liquidity === 0n) continue

                if (pool.token0Id == tokenId) {
                    // whitelist token is token1
                    let token1 = await this.entities.getOrFail(Token, pool.token1Id)
                    // get the derived ETH in pool
                    let ethLocked = pool.totalValueLockedToken1 * token1.derivedETH
                    if (ethLocked > largestLiquidityETH) {
                        largestLiquidityETH = ethLocked
                        // token1 per our token * Eth per token1
                        priceSoFar = pool.token1Price * token1.derivedETH
                    }
                }
                if (pool.token1Id == tokenId) {
                    // whitelist token is token0
                    let token0 = await this.entities.getOrFail(Token, pool.token0Id)
                    // get the derived ETH in pool
                    let ethLocked = pool.totalValueLockedToken0 * token0.derivedETH
                    if (ethLocked > largestLiquidityETH) {
                        largestLiquidityETH = ethLocked
                        // token0 per our token * ETH per token0
                        priceSoFar = pool.token0Price * token0.derivedETH
                    }
                }
            }
        }
        return priceSoFar // nothing was found return 0
    }

    async updateUniswapDayData(block: EvmBlock): Promise<UniswapDayData> {
        let uniswap = await this.getFactory()

        let dayID = getDayIndex(block.timestamp)
        const id = snapshotId(FACTORY_ADDRESS, dayID)

        let uniswapDayData = await this.entities.get(UniswapDayData, id, false)
        if (uniswapDayData == null) {
            uniswapDayData = createUniswapDayData(FACTORY_ADDRESS, dayID)
            this.entities.add(uniswapDayData)
        }
        uniswapDayData.tvlUSD = uniswap.totalValueLockedUSD
        uniswapDayData.txCount = uniswap.txCount

        return uniswapDayData
    }

    async updatePoolDayData(block: EvmBlock, poolId: string): Promise<PoolDayData> {
        let pool = await this.entities.getOrFail(Pool, poolId)

        let dayID = getDayIndex(block.timestamp)
        let dayPoolID = snapshotId(poolId, dayID)

        let poolDayData = this.entities.get(PoolDayData, dayPoolID, false)
        if (poolDayData == null) {
            poolDayData = createPoolDayData(poolId, dayID)
            this.entities.add(poolDayData)
        }

        if (pool.token0Price > poolDayData.high) {
            poolDayData.high = pool.token0Price
        }
        if (pool.token0Price < poolDayData.low) {
            poolDayData.low = pool.token0Price
        }

        poolDayData.liquidity = pool.liquidity
        poolDayData.sqrtPrice = pool.sqrtPrice
        poolDayData.feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128
        poolDayData.feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128
        poolDayData.token0Price = pool.token0Price
        poolDayData.token1Price = pool.token1Price
        poolDayData.tick = pool.tick
        poolDayData.tvlUSD = pool.totalValueLockedUSD
        poolDayData.txCount = pool.txCount

        return poolDayData
    }

    async updatePoolHourData(block: EvmBlock, poolId: string): Promise<PoolHourData> {
        let pool = await this.entities.getOrFail(Pool, poolId)

        let hourID = getDayIndex(block.timestamp)
        let hourPoolID = snapshotId(poolId, hourID)

        let poolHourData = this.entities.get(PoolHourData, hourPoolID, false)
        if (poolHourData == null) {
            poolHourData = createPoolHourData(poolId, hourID)
            this.entities.add(poolHourData)
        }

        if (pool.token0Price > poolHourData.high) {
            poolHourData.high = pool.token0Price
        }
        if (pool.token0Price < poolHourData.low) {
            poolHourData.low = pool.token0Price
        }

        poolHourData.liquidity = pool.liquidity
        poolHourData.sqrtPrice = pool.sqrtPrice
        poolHourData.feeGrowthGlobal0X128 = pool.feeGrowthGlobal0X128
        poolHourData.feeGrowthGlobal1X128 = pool.feeGrowthGlobal1X128
        poolHourData.token0Price = pool.token0Price
        poolHourData.token1Price = pool.token1Price
        poolHourData.tick = pool.tick
        poolHourData.tvlUSD = pool.totalValueLockedUSD
        poolHourData.txCount = pool.txCount

        return poolHourData
    }

    async updateTokenDayData(block: EvmBlock, tokenId: string): Promise<TokenDayData> {
        let bundle = await this.getBundle()

        let token = await this.entities.getOrFail(Token, tokenId)

        let dayID = getDayIndex(block.timestamp)
        let tokenDayID = snapshotId(tokenId, dayID)

        let tokenPrice = token.derivedETH * bundle.ethPriceUSD

        let tokenDayData = await this.entities.get(TokenDayData, tokenDayID, false)
        if (tokenDayData == null) {
            tokenDayData = createTokenDayData(tokenId, dayID)
            this.entities.add(tokenDayData)
        }

        if (tokenPrice > tokenDayData.high) {
            tokenDayData.high = tokenPrice
        }

        if (tokenPrice < tokenDayData.low) {
            tokenDayData.low = tokenPrice
        }

        tokenDayData.close = tokenPrice
        tokenDayData.priceUSD = token.derivedETH * bundle.ethPriceUSD
        tokenDayData.totalValueLocked = token.totalValueLocked
        tokenDayData.totalValueLockedUSD = token.totalValueLockedUSD

        return tokenDayData
    }

    async updateTokenHourData(block: EvmBlock, tokenId: string): Promise<TokenHourData> {
        let bundle = await this.getBundle()

        let token = await this.entities.getOrFail(Token, tokenId)

        let hourID = getDayIndex(block.timestamp)
        let tokenHourID = snapshotId(tokenId, hourID)

        let tokenPrice = token.derivedETH * bundle.ethPriceUSD

        let tokenHourData = this.entities.get(TokenHourData, tokenHourID, false)
        if (tokenHourData == null) {
            tokenHourData = createTokenHourData(tokenId, hourID)
            this.entities.add(tokenHourData)
        }

        if (tokenPrice > tokenHourData.high) {
            tokenHourData.high = tokenPrice
        }

        if (tokenPrice < tokenHourData.low) {
            tokenHourData.low = tokenPrice
        }

        tokenHourData.close = tokenPrice
        tokenHourData.priceUSD = token.derivedETH * bundle.ethPriceUSD
        tokenHourData.totalValueLocked = token.totalValueLocked
        tokenHourData.totalValueLockedUSD = token.totalValueLockedUSD

        return tokenHourData as TokenHourData
    }

    async updateTickDayData(block: EvmBlock, tickId: string): Promise<TickDayData> {
        let tick = await this.entities.getOrFail(Tick, tickId)

        let dayID = getDayIndex(block.timestamp)
        let tickDayDataID = snapshotId(tickId, dayID)

        let tickDayData = await this.entities.get(TickDayData, tickDayDataID)
        if (tickDayData == null) {
            tickDayData = createTickDayData(tickId, dayID)
            this.entities.add(tickDayData)
        }

        tickDayData.liquidityGross = tick.liquidityGross
        tickDayData.liquidityNet = tick.liquidityNet
        tickDayData.volumeToken0 = tick.volumeToken0
        tickDayData.volumeToken1 = tick.volumeToken0
        tickDayData.volumeUSD = tick.volumeUSD
        tickDayData.feesUSD = tick.feesUSD
        tickDayData.feeGrowthOutside0X128 = tick.feeGrowthOutside0X128
        tickDayData.feeGrowthOutside1X128 = tick.feeGrowthOutside1X128

        return tickDayData
    }
}

function createTransaction(
    block: {height: number; timestamp: number},
    transaction: {hash: string; gasPrice: bigint; gas: bigint}
) {
    return new Transaction({
        id: transaction.hash,
        blockNumber: block.height,
        timestamp: new Date(block.timestamp),
        gasUsed: transaction.gas,
        gasPrice: transaction.gasPrice,
    })
}

function collectTokensFromPools(pools: Iterable<Pool>) {
    const ids = new Set<string>()
    for (const pool of pools) {
        ids.add(pool.token0Id)
        ids.add(pool.token1Id)
    }
    return ids
}

function collectTicksFromPools(pools: Iterable<Pool>) {
    const ids = new Set<string>()
    for (const pool of pools) {
        ids.add(tickId(pool.id, pool.tick ?? 0))
    }
    return ids
}

function collectWhiteListPoolsFromTokens(tokens: Iterable<Token>) {
    const ids = new Set<string>()
    for (const token of tokens) {
        token.whitelistPools.forEach((id) => ids.add(id))
    }
    return ids
}

interface InitializeData {
    poolId: string
    tick: number
    sqrtPrice: bigint
}

function processInitialize(ctx: LogHandlerContext<unknown, {evmLog: {topics: true; data: true}}>): InitializeData {
    let event = poolAbi.events['Initialize(uint160,int24)'].decode(ctx.evmLog)
    return {
        poolId: ctx.evmLog.address,
        tick: event.tick,
        sqrtPrice: event.sqrtPriceX96.toBigInt(),
    }
}

interface MintData {
    transaction: {hash: string; gasPrice: bigint; from: string; gas: bigint}
    poolId: string
    amount0: bigint
    amount1: bigint
    amount: bigint
    tickLower: number
    tickUpper: number
    sender: string
    owner: string
    logIndex: number
}

function processMint(
    ctx: LogHandlerContext<
        unknown,
        {evmLog: {topics: true; data: true}; transaction: {gasPrice: true; from: true; gas: true; hash: true}}
    >
): MintData {
    let event = poolAbi.events['Mint(address,address,int24,int24,uint128,uint256,uint256)'].decode(ctx.evmLog)
    return {
        transaction: {
            hash: ctx.transaction.hash,
            gasPrice: ctx.transaction.gasPrice,
            from: ctx.transaction.from,
            gas: ctx.transaction.gas,
        },
        poolId: ctx.evmLog.address,
        amount0: event.amount0.toBigInt(),
        amount1: event.amount1.toBigInt(),
        amount: event.amount.toBigInt(),
        tickLower: event.tickLower,
        tickUpper: event.tickUpper,
        sender: event.sender,
        owner: event.owner,
        logIndex: ctx.evmLog.index,
    }
}

interface BurnData {
    transaction: {hash: string; gasPrice: bigint; from: string; gas: bigint}
    poolId: string
    amount0: bigint
    amount1: bigint
    amount: bigint
    tickLower: number
    tickUpper: number
    owner: string
    logIndex: number
}

function processBurn(
    ctx: LogHandlerContext<
        unknown,
        {evmLog: {topics: true; data: true}; transaction: {gasPrice: true; from: true; gas: true; hash: true}}
    >
): BurnData {
    let event = poolAbi.events['Burn(address,int24,int24,uint128,uint256,uint256)'].decode(ctx.evmLog)
    return {
        transaction: {
            hash: ctx.transaction.hash,
            gasPrice: ctx.transaction.gasPrice,
            from: ctx.transaction.from,
            gas: ctx.transaction.gas,
        },
        poolId: ctx.evmLog.address,
        amount0: event.amount0.toBigInt(),
        amount1: event.amount1.toBigInt(),
        amount: event.amount.toBigInt(),
        tickLower: event.tickLower,
        tickUpper: event.tickUpper,
        owner: event.owner,
        logIndex: ctx.evmLog.index,
    }
}

interface SwapData {
    transaction: {hash: string; gasPrice: bigint; from: string; gas: bigint}
    poolId: string
    amount0: bigint
    amount1: bigint
    tick: number
    sqrtPrice: bigint
    sender: string
    recipient: string
    liquidity: bigint
    logIndex: number
}

function processSwap(
    ctx: LogHandlerContext<
        unknown,
        {evmLog: {topics: true; data: true}; transaction: {gasPrice: true; from: true; gas: true; hash: true}}
    >
): SwapData {
    let event = poolAbi.events['Swap(address,address,int256,int256,uint160,uint128,int24)'].decode(ctx.evmLog)
    return {
        transaction: {
            hash: ctx.transaction.hash,
            gasPrice: ctx.transaction.gasPrice,
            from: ctx.transaction.from,
            gas: ctx.transaction.gas,
        },
        poolId: ctx.evmLog.address,
        amount0: event.amount0.toBigInt(),
        amount1: event.amount1.toBigInt(),
        tick: event.tick,
        sqrtPrice: event.sqrtPriceX96.toBigInt(),
        sender: event.sender,
        recipient: event.recipient,
        logIndex: ctx.evmLog.index,
        liquidity: event.liquidity.toBigInt(),
    }
}

export async function handleFlash(ctx: LogHandlerContext<Store>): Promise<void> {
    // update fee growth
    let pool = await ctx.store.get(Pool, ctx.evmLog.address).then(assertNotNull)
    let poolContract = new poolAbi.Contract(ctx, ctx.evmLog.address)
    let feeGrowthGlobal0X128 = await poolContract.feeGrowthGlobal0X128.call()
    let feeGrowthGlobal1X128 = await poolContract.feeGrowthGlobal1X128.call()
    pool.feeGrowthGlobal0X128 = feeGrowthGlobal0X128.toBigInt()
    pool.feeGrowthGlobal1X128 = feeGrowthGlobal1X128.toBigInt()
    await ctx.store.save(pool)
}

async function updateTickFeeVars(ctx: BlockHandlerContext<Store>, ticks: Tick[]): Promise<void> {
    // not all ticks are initialized so obtaining null is expected behavior
    let poolContract = new poolAbi.MulticallContract(ctx, MULTICALL_ADDRESS)
    let tickResult = await poolContract.ticks.call(ticks.map((t) => [t.poolId, [Number(t.tickIdx)]]))

    for (let i = 0; i < ticks.length; i++) {
        ticks[i].feeGrowthOutside0X128 = tickResult[i][1].toBigInt()
        ticks[i].feeGrowthOutside1X128 = tickResult[i][3].toBigInt()
    }
}

async function updatePoolFeeVars(ctx: BlockHandlerContext<Store>, pools: Pool[]): Promise<void> {
    let poolContract = new poolAbi.MulticallContract(ctx, MULTICALL_ADDRESS)
    let fee0 = await poolContract.feeGrowthGlobal0X128.call(pools.map((p) => p.id))
    let fee1 = await poolContract.feeGrowthGlobal1X128.call(pools.map((p) => p.id))

    for (let i = 0; i < pools.length; i++) {
        pools[i].feeGrowthGlobal0X128 = fee0[i].toBigInt()
        pools[i].feeGrowthGlobal1X128 = fee1[i].toBigInt()
    }
}

function tickId(poolId: string, tickIdx: number) {
    return `${poolId}#${tickIdx}`
}

type Item =
    | LogItem<{
          evmLog: {
              topics: true
              data: true
          }
          transaction: {
              hash: true
              from: true
              gas: true
              gasPrice: true
          }
      }>
    | TransactionItem
