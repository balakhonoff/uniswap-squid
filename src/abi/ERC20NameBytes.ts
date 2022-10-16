import assert from 'assert'
import * as ethers from 'ethers'
import {EvmLog, EvmTransaction, Block, ChainContext, BlockContext, Chain, Result, rawMulticallAbi} from './support'

export const rawAbi = [{"type":"function","name":"name","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"bytes32"}]}]

export const abi = new ethers.utils.Interface(rawAbi);
export const multicallAbi = new ethers.utils.Interface(rawMulticallAbi);

class Events {
}

export const events = new Events()

class Functions {
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

  'name()' = {
    call: (): Promise<string> => this.call('name()', []),
    tryCall: (): Promise<Result<string>> => this.tryCall('name()', [])
  }

  name = this['name()']

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

  'name()' = {
    call: (args: string[]): Promise<string[]> => this.call('name()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<string>[]> => this.tryCall('name()', args.map((arg) => [arg, []]))
  }

  name = this['name()']

  private async call(signature: string, args: [string, any[]][]) : Promise<any> {
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
