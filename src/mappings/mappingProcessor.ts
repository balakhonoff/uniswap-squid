import {
    BatchBlock,
    BatchProcessorItem,
    CommonHandlerContext,
    EvmBatchProcessor,
    EvmBlock,
} from '@subsquid/evm-processor'
import {Store} from '@subsquid/typeorm-store'
import {EntityManager} from '../utils/entityManager'

export abstract class MappingProcessor<Item> {
    protected entities: EntityManager

    constructor(protected ctx: CommonHandlerContext<Store>) {
        this.entities = new EntityManager(ctx.store)
    }

    abstract run<I>(blocks: BatchBlock<Extract<I, Item>>[]): Promise<void>

    protected createContext(block: EvmBlock) {
        return {...this.ctx, block}
    }

    protected processItem(blocks: BatchBlock<Item>[], fn: (block: EvmBlock, item: Item) => void) {
        for (let block of blocks) {
            for (let item of block.items) {
                fn(block.header, item)
            }
        }
    }
}
