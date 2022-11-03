import assert from 'assert'
import * as ethers from 'ethers'
import {EvmLog, EvmTransaction, Block, ChainContext, BlockContext, Chain, Result, rawMulticallAbi} from './support'

export const rawAbi = [{"type":"event","anonymous":false,"name":"FeeAmountEnabled","inputs":[{"type":"uint24","name":"fee","indexed":true},{"type":"int24","name":"tickSpacing","indexed":true}]},{"type":"event","anonymous":false,"name":"OwnerChanged","inputs":[{"type":"address","name":"oldOwner","indexed":true},{"type":"address","name":"newOwner","indexed":true}]},{"type":"event","anonymous":false,"name":"PoolCreated","inputs":[{"type":"address","name":"token0","indexed":true},{"type":"address","name":"token1","indexed":true},{"type":"uint24","name":"fee","indexed":true},{"type":"int24","name":"tickSpacing","indexed":false},{"type":"address","name":"pool","indexed":false}]},{"type":"function","name":"createPool","constant":false,"payable":false,"inputs":[{"type":"address","name":"tokenA"},{"type":"address","name":"tokenB"},{"type":"uint24","name":"fee"}],"outputs":[{"type":"address","name":"pool"}]},{"type":"function","name":"enableFeeAmount","constant":false,"payable":false,"inputs":[{"type":"uint24","name":"fee"},{"type":"int24","name":"tickSpacing"}],"outputs":[]},{"type":"function","name":"feeAmountTickSpacing","constant":true,"stateMutability":"view","payable":false,"inputs":[{"type":"uint24","name":"fee"}],"outputs":[{"type":"int24"}]},{"type":"function","name":"getPool","constant":true,"stateMutability":"view","payable":false,"inputs":[{"type":"address","name":"tokenA"},{"type":"address","name":"tokenB"},{"type":"uint24","name":"fee"}],"outputs":[{"type":"address","name":"pool"}]},{"type":"function","name":"owner","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"address"}]},{"type":"function","name":"setOwner","constant":false,"payable":false,"inputs":[{"type":"address","name":"_owner"}],"outputs":[]}]

export const abi = new ethers.utils.Interface(rawAbi);
export const multicallAbi = new ethers.utils.Interface(rawMulticallAbi);

export type FeeAmountEnabled0Event = ([fee: number, tickSpacing: number] & {fee: number, tickSpacing: number})

export type OwnerChanged0Event = ([oldOwner: string, newOwner: string] & {oldOwner: string, newOwner: string})

export type PoolCreated0Event = ([token0: string, token1: string, fee: number, tickSpacing: number, pool: string] & {token0: string, token1: string, fee: number, tickSpacing: number, pool: string})

class Events {

  'FeeAmountEnabled(uint24,int24)' = {
    topic: abi.getEventTopic('FeeAmountEnabled(uint24,int24)'),
    decode(data: EvmLog): FeeAmountEnabled0Event {
      return abi.decodeEventLog('FeeAmountEnabled(uint24,int24)', data.data, data.topics) as any
    }
  }

  FeeAmountEnabled = this['FeeAmountEnabled(uint24,int24)']

  'OwnerChanged(address,address)' = {
    topic: abi.getEventTopic('OwnerChanged(address,address)'),
    decode(data: EvmLog): OwnerChanged0Event {
      return abi.decodeEventLog('OwnerChanged(address,address)', data.data, data.topics) as any
    }
  }

  OwnerChanged = this['OwnerChanged(address,address)']

  'PoolCreated(address,address,uint24,int24,address)' = {
    topic: abi.getEventTopic('PoolCreated(address,address,uint24,int24,address)'),
    decode(data: EvmLog): PoolCreated0Event {
      return abi.decodeEventLog('PoolCreated(address,address,uint24,int24,address)', data.data, data.topics) as any
    }
  }

  PoolCreated = this['PoolCreated(address,address,uint24,int24,address)']
}

export const events = new Events()

export type CreatePool0Function = ([tokenA: string, tokenB: string, fee: number] & {tokenA: string, tokenB: string, fee: number})

export type EnableFeeAmount0Function = ([fee: number, tickSpacing: number] & {fee: number, tickSpacing: number})

export type SetOwner0Function = ([_owner: string] & {_owner: string})

class Functions {

  'createPool(address,address,uint24)' = {
    sighash: abi.getSighash('createPool(address,address,uint24)'),
    decode(data: EvmTransaction | string): CreatePool0Function {
      return abi.decodeFunctionData('createPool(address,address,uint24)', typeof data === 'string' ? data : data.input) as any
    }
  }

  createPool = this['createPool(address,address,uint24)']

  'enableFeeAmount(uint24,int24)' = {
    sighash: abi.getSighash('enableFeeAmount(uint24,int24)'),
    decode(data: EvmTransaction | string): EnableFeeAmount0Function {
      return abi.decodeFunctionData('enableFeeAmount(uint24,int24)', typeof data === 'string' ? data : data.input) as any
    }
  }

  enableFeeAmount = this['enableFeeAmount(uint24,int24)']

  'setOwner(address)' = {
    sighash: abi.getSighash('setOwner(address)'),
    decode(data: EvmTransaction | string): SetOwner0Function {
      return abi.decodeFunctionData('setOwner(address)', typeof data === 'string' ? data : data.input) as any
    }
  }

  setOwner = this['setOwner(address)']
}

export const functions = new Functions()

export class Contract {
  private readonly _chain: Chain
  private readonly blockHeight: string
  readonly address: string

  constructor(ctx: BlockContext, address: string)
  constructor(ctx: ChainContext, block: Block, address: string)
  constructor(ctx: BlockContext, blockOrAddress: Block | string, address?: string) {
    this._chain = ctx._chain
    if (typeof blockOrAddress === 'string')  {
      this.blockHeight = '0x' + ctx.block.height.toString(16)
      this.address = ethers.utils.getAddress(blockOrAddress)
    }
    else  {
      assert(address != null)
      this.blockHeight = '0x' + blockOrAddress.height.toString(16)
      this.address = ethers.utils.getAddress(address)
    }
  }

  'feeAmountTickSpacing(uint24)' = {
    call: (fee: number): Promise<number> => this.call('feeAmountTickSpacing(uint24)', [fee]),
    tryCall: (fee: number): Promise<Result<number>> => this.tryCall('feeAmountTickSpacing(uint24)', [fee])
  }

  feeAmountTickSpacing = this['feeAmountTickSpacing(uint24)']

  'getPool(address,address,uint24)' = {
    call: (tokenA: string, tokenB: string, fee: number): Promise<string> => this.call('getPool(address,address,uint24)', [tokenA, tokenB, fee]),
    tryCall: (tokenA: string, tokenB: string, fee: number): Promise<Result<string>> => this.tryCall('getPool(address,address,uint24)', [tokenA, tokenB, fee])
  }

  getPool = this['getPool(address,address,uint24)']

  'owner()' = {
    call: (): Promise<string> => this.call('owner()', []),
    tryCall: (): Promise<Result<string>> => this.tryCall('owner()', [])
  }

  owner = this['owner()']

  private async call(signature: string, args: any[]) : Promise<any> {
    const data = abi.encodeFunctionData(signature, args)
    const result = await this._chain.client.call('eth_call', [{to: this.address, data}, this.blockHeight])
    const decoded = abi.decodeFunctionResult(signature, result)
    return decoded.length > 1 ? decoded : decoded[0]
  }

  private async tryCall(signature: string, args: any[]) : Promise<Result<any>> {
    return this.call(signature, args).then(r => ({success: true, value: r})).catch(() => ({success: false}))
  }
}

export class MulticallContract {
  private readonly _chain: Chain
  private readonly blockHeight: string
  readonly address: string

  constructor(ctx: BlockContext, address: string)
  constructor(ctx: ChainContext, block: Block, address: string)
  constructor(ctx: BlockContext, blockOrAddress: Block | string, address?: string) {
    this._chain = ctx._chain
    if (typeof blockOrAddress === 'string')  {
      this.blockHeight = '0x' + ctx.block.height.toString(16)
      this.address = ethers.utils.getAddress(blockOrAddress)
    }
    else  {
      assert(address != null)
      this.blockHeight = '0x' + blockOrAddress.height.toString(16)
      this.address = ethers.utils.getAddress(address)
    }
  }

  'feeAmountTickSpacing(uint24)' = {
    call: (args: [string, [fee: number]][]): Promise<number[]> => this.call('feeAmountTickSpacing(uint24)', args),
    tryCall: (args: [string, [fee: number]][]): Promise<Result<number>[]> => this.tryCall('feeAmountTickSpacing(uint24)', args)
  }

  feeAmountTickSpacing = this['feeAmountTickSpacing(uint24)']

  'getPool(address,address,uint24)' = {
    call: (args: [string, [tokenA: string, tokenB: string, fee: number]][]): Promise<string[]> => this.call('getPool(address,address,uint24)', args),
    tryCall: (args: [string, [tokenA: string, tokenB: string, fee: number]][]): Promise<Result<string>[]> => this.tryCall('getPool(address,address,uint24)', args)
  }

  getPool = this['getPool(address,address,uint24)']

  'owner()' = {
    call: (args: string[]): Promise<string[]> => this.call('owner()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<string>[]> => this.tryCall('owner()', args.map((arg) => [arg, []]))
  }

  owner = this['owner()']

  private async call(signature: string, args: [string, any[]][]) : Promise<any> {
    if (args.length == 0) return []
    const encodedArgs = args.map((arg) => [arg[0], abi.encodeFunctionData(signature, arg[1])])
    const data = multicallAbi.encodeFunctionData('aggregate', [encodedArgs])
    const response = await this._chain.client.call('eth_call', [{to: this.address, data}, this.blockHeight])
    const batch = multicallAbi.decodeFunctionResult('aggregate', response).returnData
    const result: any[] = []
    for (const item of batch) {
      const decodedItem = abi.decodeFunctionResult(signature, item)
      result.push(decodedItem.length > 1 ? decodedItem : decodedItem[0])
    }
    return result
  }

  private async tryCall(signature: string, args: [string, any[]][]) : Promise<Result<any>[]> {
    if (args.length == 0) return []
    const encodedArgs = args.map((arg) => [arg[0], abi.encodeFunctionData(signature, arg[1])])
    const data = multicallAbi.encodeFunctionData('tryAggregate', [false, encodedArgs])
    const response = await this._chain.client.call('eth_call', [{to: this.address, data}, this.blockHeight])
    const batch = multicallAbi.decodeFunctionResult('tryAggregate', response).returnData
    const result: any[] = []
    for (const item of batch) {
      try {
        if (!item.success) throw new Error()
        const decodedItem = abi.decodeFunctionResult(signature, item.returnData)
        result.push({success:true, value: decodedItem.length > 1 ? decodedItem : decodedItem[0]})
      } catch {
        result.push({success: false})
      }
    }
    return result
  }
}
