import {EvmBatchProcessor} from '@subsquid/evm-processor'
import {TypeormDatabase} from '@subsquid/typeorm-store'
import {CHAIN_NODE, FACTORY_ADDRESS, POSITIONS_ADDRESS} from './utils/constants'
import {FactoryProcessor} from './mappings/factory'
import {PairsProcessor} from './mappings/core'
import {PositionProcessor} from './mappings/positionManager'
import * as factoryAbi from './abi/factory'
import * as poolAbi from './abi/pool'
import * as positionsAbi from './abi/NonfungiblePositionManager'

let processor = new EvmBatchProcessor()
    .setBlockRange({from: 12369621})
    .setDataSource({
        archive: 'https://eth-test.archive.subsquid.io',
        chain: process.env.CHAIN_NODE,
    })
    .addLog(FACTORY_ADDRESS, {
        filter: [[factoryAbi.events['PoolCreated(address,address,uint24,int24,address)'].topic]],
        data: {
            evmLog: {
                topics: true,
                data: true,
            },
        } as const,
    })
    .addLog([], {
        filter: [
            [
                poolAbi.events['Burn(address,int24,int24,uint128,uint256,uint256)'].topic,
                poolAbi.events['Mint(address,address,int24,int24,uint128,uint256,uint256)'].topic,
                poolAbi.events['Initialize(uint160,int24)'].topic,
                poolAbi.events['Swap(address,address,int256,int256,uint160,uint128,int24)'].topic,
            ],
        ],
        data: {
            evmLog: {
                topics: true,
                data: true,
            },
            transaction: {
                hash: true,
                gasPrice: true,
                gas: true,
                from: true,
            },
        } as const,
    })
    .addLog(POSITIONS_ADDRESS, {
        filter: [
            [
                positionsAbi.events['IncreaseLiquidity(uint256,uint128,uint256,uint256)'].topic,
                positionsAbi.events['DecreaseLiquidity(uint256,uint128,uint256,uint256)'].topic,
                positionsAbi.events['Collect(uint256,address,uint256,uint256)'].topic,
                positionsAbi.events['Transfer(address,address,uint256)'].topic,
            ],
        ],
        data: {
            evmLog: {
                topics: true,
                data: true,
            },
        } as const,
    })

processor.run(new TypeormDatabase(), async (ctx) => {
    console.time('factory')
    await new FactoryProcessor(ctx).run(ctx.blocks)
    console.timeEnd('factory')
    console.time('core')
    await new PairsProcessor(ctx).run(ctx.blocks)
    console.timeEnd('core')
    console.time('positions')
    await new PositionProcessor(ctx).run(ctx.blocks)
    console.timeEnd('positions')
})
