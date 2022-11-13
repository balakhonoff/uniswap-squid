import assert from 'assert'
import * as ethers from 'ethers'
import {EvmLog, EvmTransaction, Block, ChainContext, BlockContext, Chain, Result, rawMulticallAbi} from './support'

export const rawAbi = [{"type":"function","name":"symbol","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"bytes32"}]}]

export const abi = new ethers.utils.Interface(rawAbi);
export const multicallAbi = new ethers.utils.Interface(rawMulticallAbi);

class Events {
  private readonly _abi = abi
}

export const events = new Events()

class Functions {
  private readonly _abi = abi
}

export const functions = new Functions()

export class Contract {
  private readonly _abi = abi
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

  'symbol()' = {
    call: (): Promise<string> => this.call('symbol()', []),
    tryCall: (): Promise<Result<string>> => this.tryCall('symbol()', [])
  }

  symbol = this['symbol()']

  private async call(signature: string, args: any[]) : Promise<any> {
    const data = this._abi.encodeFunctionData(signature, args)
    const result = await this._chain.client.call('eth_call', [{to: this.address, data}, this.blockHeight])
    const decoded = this._abi.decodeFunctionResult(signature, result)
    return decoded.length > 1 ? decoded : decoded[0]
  }

  private async tryCall(signature: string, args: any[]) : Promise<Result<any>> {
    return this.call(signature, args).then((r) => ({success: true, value: r})).catch(() => ({success: false}))
  }
}

export class MulticallContract {
  private readonly _abi = abi
  private readonly _multicallAbi = multicallAbi
  private readonly _chain: Chain
  private readonly blockHeight: string
  readonly address: string

  constructor(ctx: BlockContext, multicallAddress: string)
  constructor(ctx: ChainContext, block: Block, multicallAddress: string)
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

  'symbol()' = {
    call: (args: string[]): Promise<string[]> => this.call('symbol()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<string>[]> => this.tryCall('symbol()', args.map((arg) => [arg, []]))
  }

  symbol = this['symbol()']

  private async call(signature: string, args: [string, any[]][]) : Promise<any> {
    const encodedArgs = args.map((arg) => [arg[0], this._abi.encodeFunctionData(signature, arg[1])])
    const data = this._multicallAbi.encodeFunctionData('aggregate', [encodedArgs])
    const response = await this._chain.client.call('eth_call', [{to: this.address, data}, this.blockHeight])
    const batch: string[] = this._multicallAbi.decodeFunctionResult('aggregate', response).returnData
    return batch.map((item) => {
      const decodedItem = this._abi.decodeFunctionResult(signature, item)
      return decodedItem.length > 1 ? decodedItem : decodedItem[0]
    })
  }

  private async tryCall(signature: string, args: [string, any[]][]) : Promise<Result<any>[]> {
    const encodedArgs = args.map((arg) => [arg[0], this._abi.encodeFunctionData(signature, arg[1])])
    const data = this._multicallAbi.encodeFunctionData('tryAggregate', [false, encodedArgs])
    const response = await this._chain.client.call('eth_call', [{to: this.address, data}, this.blockHeight])
    const batch: {success: boolean, returnData: string}[] = this._multicallAbi.decodeFunctionResult('tryAggregate', response).returnData
    return batch.map((item) => {
      if (!item.success) return {success: false}
      try {
        const decodedItem = this._abi.decodeFunctionResult(signature, item.returnData)
        return {success: true, value: decodedItem.length > 1 ? decodedItem : decodedItem[0]}
      } catch {
        return {success: false}
      }
    })
  }
}
