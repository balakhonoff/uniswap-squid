import {
    CommonHandlerContext,
    BatchBlock,
    LogHandlerContext,
    EvmBlock,
    BlockHandlerContext,
} from '@subsquid/evm-processor'
import {LogItem, TransactionItem} from '@subsquid/evm-processor/lib/interfaces/dataSelection'
import {Store} from '@subsquid/typeorm-store'
import {Token, Position, Pool, PositionSnapshot} from '../model'
import {BlockMap} from '../utils/blockMap'
import {ADDRESS_ZERO, MULTICALL_ADDRESS, POSITIONS_ADDRESS, FACTORY_ADDRESS} from '../utils/constants'
import {MappingProcessor} from './mappingProcessor'
import * as positionsAbi from './../abi/NonfungiblePositionManager'
import * as factoryAbi from './../abi/factory'
import {BigDecimal} from '@subsquid/big-decimal'
import {BigNumber} from 'ethers'
import {last} from '../utils/tools'

type EventData =
    | (TransferData & {type: 'Transfer'})
    | (IncreaseData & {type: 'Increase'})
    | (DecreaseData & {type: 'Decrease'})
    | (CollectData & {type: 'Collect'})

export class PositionProcessor extends MappingProcessor<Item> {
    constructor(ctx: CommonHandlerContext<Store>) {
        super(ctx)
    }

    async run(blocks: BatchBlock<Item>[]): Promise<void> {
        const eventsData = this.processItems(blocks)
        if (eventsData.size == 0) return

        await this.prefetch(eventsData, last(blocks).header)

        for (const [block, blockEventsData] of eventsData) {
            for (const data of blockEventsData) {
                switch (data.type) {
                    case 'Increase':
                        await this.processIncreaseData(block, data)
                        break
                    case 'Decrease':
                        await this.processDecreaseData(block, data)
                        break
                    case 'Collect':
                        await this.processCollectData(block, data)
                        break
                    case 'Transfer':
                        await this.processTransferData(block, data)
                        break
                }
            }
        }

        // await updateFeeVars(this.createContext(last(blocks).header), this.entities.values(Position))

        await this.ctx.store.save(this.entities.values(Position))
    }

    private async prefetch(eventsData: BlockMap<EventData>, block: EvmBlock) {
        const positionIds = new Set<string>()
        for (const [, blockEventsData] of eventsData) {
            for (const data of blockEventsData) {
                this.entities.defer(Position, data.tokenId)
                positionIds.add(data.tokenId)
            }
        }

        await this.entities.load(Position)

        const newPositionIds: string[] = []
        for (const id of positionIds) {
            if (!this.entities.get(Position, id, false)) newPositionIds.push(id)
        }

        const newPositions = await initPositions(this.createContext(block), newPositionIds)
        for (const position of newPositions) {
            this.entities.add(position)
        }

        for (const position of this.entities.values(Position)) {
            this.entities.defer(Token, position.token0Id, position.token1Id)
        }

        await this.entities.load(Token)
    }

    private processItems(blocks: BatchBlock<Item>[]) {
        let eventsData = new BlockMap<EventData>()

        this.processItem(blocks, (block, item) => {
            if (item.kind !== 'evmLog') return
            switch (item.evmLog.topics[0]) {
                case positionsAbi.events['IncreaseLiquidity(uint256,uint128,uint256,uint256)'].topic: {
                    const data = processInreaseLiquidity({...this.createContext(block), ...item})
                    eventsData.push(block, {
                        type: 'Increase',
                        ...data,
                    })
                    return
                }
                case positionsAbi.events['DecreaseLiquidity(uint256,uint128,uint256,uint256)'].topic: {
                    const data = processDecreaseLiquidity({...this.createContext(block), ...item})
                    eventsData.push(block, {
                        type: 'Decrease',
                        ...data,
                    })
                    this.entities.defer(Position, data.tokenId)
                    return
                }
                case positionsAbi.events['Collect(uint256,address,uint256,uint256)'].topic: {
                    const data = processCollect({...this.createContext(block), ...item})
                    eventsData.push(block, {
                        type: 'Collect',
                        ...data,
                    })
                    this.entities.defer(Position, data.tokenId)
                    return
                }
                case positionsAbi.events['Transfer(address,address,uint256)'].topic: {
                    const data = processTransafer({...this.createContext(block), ...item})
                    eventsData.push(block, {
                        type: 'Transfer',
                        ...data,
                    })
                    this.entities.defer(Position, data.tokenId)
                    return
                }
            }
        })

        return eventsData
    }

    async processIncreaseData(block: EvmBlock, data: IncreaseData) {
        let position = this.entities.get(Position, data.tokenId, false)
        if (position == null) return

        let token0 = await this.entities.get(Token, position.token0Id)
        let token1 = await this.entities.get(Token, position.token1Id)

        if (!token0 || !token1) return

        let amount0 = BigDecimal(data.amount0, token0.decimals).toNumber()
        let amount1 = BigDecimal(data.amount1, token1.decimals).toNumber()

        position.liquidity = position.liquidity + data.liquidity
        position.depositedToken0 = position.depositedToken0 + amount0
        position.depositedToken1 = position.depositedToken1 + amount1

        this.updatePositionSnapshot(block, position.id)
    }

    async processDecreaseData(block: EvmBlock, data: DecreaseData) {
        // temp fix
        if (block.height == 14317993) return

        let position = this.entities.get(Position, data.tokenId, false)
        if (position == null) return

        // temp fix
        if (position.poolId === '0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248') return

        let token0 = await this.entities.get(Token, position.token0Id)
        let token1 = await this.entities.get(Token, position.token1Id)

        if (!token0 || !token1) return

        let amount0 = BigDecimal(data.amount0, token0.decimals).toNumber()
        let amount1 = BigDecimal(data.amount1, token1.decimals).toNumber()

        position.liquidity = position.liquidity - data.liquidity
        position.withdrawnToken0 = position.depositedToken0 + amount0
        position.withdrawnToken1 = position.depositedToken1 + amount1

        this.updatePositionSnapshot(block, position.id)
    }

    async processCollectData(block: EvmBlock, data: CollectData) {
        let position = this.entities.get(Position, data.tokenId, false)
        // position was not able to be fetched
        if (position == null) return

        if (position.poolId === '0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248') return

        let token0 = this.entities.getOrFail(Token, position.token0Id, false)
        let amount0 = BigDecimal(data.amount0, token0.decimals).toNumber()

        position.collectedFeesToken0 = position.collectedFeesToken0 + amount0
        position.collectedFeesToken1 = position.collectedFeesToken1 + amount0

        this.updatePositionSnapshot(block, position.id)
    }

    async processTransferData(block: EvmBlock, data: TransferData) {
        let position = this.entities.get(Position, data.tokenId, false)
        // position was not able to be fetched
        if (position == null) return

        position.owner = data.to

        this.updatePositionSnapshot(block, position.id)
    }

    private async updatePositionSnapshot(block: EvmBlock, positionId: string) {
        const position = this.entities.getOrFail(Position, positionId, false)

        const positionBlockId = snapshotId(positionId, block.height)

        let positionSnapshot = this.entities.get(PositionSnapshot, positionBlockId, false)
        if (!positionSnapshot) {
            positionSnapshot = new PositionSnapshot({id: positionBlockId})
            this.entities.add(positionSnapshot)
        }
        positionSnapshot.owner = position.owner
        positionSnapshot.pool = position.pool
        positionSnapshot.positionId = positionId
        positionSnapshot.blockNumber = block.height
        positionSnapshot.timestamp = new Date(block.timestamp)
        positionSnapshot.liquidity = position.liquidity
        positionSnapshot.depositedToken0 = position.depositedToken0
        positionSnapshot.depositedToken1 = position.depositedToken1
        positionSnapshot.withdrawnToken0 = position.withdrawnToken0
        positionSnapshot.withdrawnToken1 = position.withdrawnToken1
        positionSnapshot.collectedFeesToken0 = position.collectedFeesToken0
        positionSnapshot.collectedFeesToken1 = position.collectedFeesToken1
        return
    }
}

function createPosition(positionId: string) {
    const position = new Position({id: positionId})

    position.owner = ADDRESS_ZERO
    position.liquidity = 0n
    position.depositedToken0 = 0
    position.depositedToken1 = 0
    position.withdrawnToken0 = 0
    position.withdrawnToken1 = 0
    position.collectedFeesToken0 = 0
    position.collectedFeesToken1 = 0
    position.feeGrowthInside0LastX128 = 0n
    position.feeGrowthInside1LastX128 = 0n

    return position
}

async function initPositions(ctx: BlockHandlerContext<unknown>, ids: string[]) {
    let contract = new positionsAbi.MulticallContract(ctx, MULTICALL_ADDRESS)

    const positionResults = await contract.positions.tryCall(ids.map((id) => [POSITIONS_ADDRESS, [BigNumber.from(id)]]))

    const positionsData: {positionId: string; token0Id: string; token1Id: string; fee: number}[] = []
    for (let i = 0; i < ids.length; i++) {
        const result = positionResults[i]
        if (!result.success) continue
        positionsData.push({
            positionId: ids[i].toLowerCase(),
            token0Id: result.value.token0.toLowerCase(),
            token1Id: result.value.token1.toLowerCase(),
            fee: result.value.fee,
        })
    }

    let factoryContract = new factoryAbi.MulticallContract(ctx, MULTICALL_ADDRESS)
    const poolIds = await factoryContract.getPool.call(
        positionsData.map((p) => [FACTORY_ADDRESS, [p.token0Id, p.token1Id, p.fee]])
    )

    const positions: Position[] = []
    for (let i = 0; i < positionsData.length; i++) {
        const position = createPosition(positionsData[i].positionId)
        position.token0Id = positionsData[i].token0Id
        position.token1Id = positionsData[i].token1Id
        position.poolId = poolIds[i].toLowerCase()
        positions.push(position)
    }

    return positions
}

async function updateFeeVars(ctx: BlockHandlerContext<unknown>, positions: Position[]) {
    let positionManagerContract = new positionsAbi.MulticallContract(ctx, MULTICALL_ADDRESS)
    let positionResult = await positionManagerContract.positions.tryCall(
        positions.map((p) => [POSITIONS_ADDRESS, [BigNumber.from(p.id)]])
    )

    for (let i = 0; i < positions.length; i++) {
        const result = positionResult[i]
        if (!result.success) continue

        positions[i].feeGrowthInside0LastX128 = result.value.feeGrowthInside0LastX128.toBigInt()
        positions[i].feeGrowthInside1LastX128 = result.value.feeGrowthInside1LastX128.toBigInt()
    }
}

function snapshotId(positionId: string, block: number) {
    return `${positionId}#${block}`
}

interface IncreaseData {
    tokenId: string
    amount0: bigint
    amount1: bigint
    liquidity: bigint
}

function processInreaseLiquidity(ctx: LogHandlerContext<unknown, {evmLog: {topics: true; data: true}}>): IncreaseData {
    const event = positionsAbi.events['IncreaseLiquidity(uint256,uint128,uint256,uint256)'].decode(ctx.evmLog)

    return {
        tokenId: event.tokenId.toString(),
        amount0: event.amount0.toBigInt(),
        amount1: event.amount1.toBigInt(),
        liquidity: event.liquidity.toBigInt(),
    }
}

interface DecreaseData {
    tokenId: string
    amount0: bigint
    amount1: bigint
    liquidity: bigint
}

function processDecreaseLiquidity(ctx: LogHandlerContext<unknown, {evmLog: {topics: true; data: true}}>): DecreaseData {
    const event = positionsAbi.events['DecreaseLiquidity(uint256,uint128,uint256,uint256)'].decode(ctx.evmLog)

    return {
        tokenId: event.tokenId.toString(),
        amount0: event.amount0.toBigInt(),
        amount1: event.amount1.toBigInt(),
        liquidity: event.liquidity.toBigInt(),
    }
}

interface CollectData {
    tokenId: string
    amount0: bigint
    amount1: bigint
}

function processCollect(ctx: LogHandlerContext<unknown, {evmLog: {topics: true; data: true}}>): CollectData {
    const event = positionsAbi.events['Collect(uint256,address,uint256,uint256)'].decode(ctx.evmLog)

    return {
        tokenId: event.tokenId.toString(),
        amount0: event.amount0.toBigInt(),
        amount1: event.amount1.toBigInt(),
    }
}

interface TransferData {
    tokenId: string
    to: string
}

function processTransafer(ctx: LogHandlerContext<unknown, {evmLog: {topics: true; data: true}}>): TransferData {
    const event = positionsAbi.events['Transfer(address,address,uint256)'].decode(ctx.evmLog)

    return {
        tokenId: event.tokenId.toString(),
        to: event.to.toLowerCase(),
    }
}

type Item =
    | LogItem<{
          evmLog: {
              topics: true
              data: true
          }
      }>
    | TransactionItem
