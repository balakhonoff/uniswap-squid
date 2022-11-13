import assert from 'assert'
import * as ethers from 'ethers'
import {EvmLog, EvmTransaction, Block, ChainContext, BlockContext, Chain, Result, rawMulticallAbi} from './support'

export const rawAbi = [{"type":"constructor","payable":false,"inputs":[]},{"type":"event","anonymous":false,"name":"Burn","inputs":[{"type":"address","name":"owner","indexed":true},{"type":"int24","name":"tickLower","indexed":true},{"type":"int24","name":"tickUpper","indexed":true},{"type":"uint128","name":"amount","indexed":false},{"type":"uint256","name":"amount0","indexed":false},{"type":"uint256","name":"amount1","indexed":false}]},{"type":"event","anonymous":false,"name":"Collect","inputs":[{"type":"address","name":"owner","indexed":true},{"type":"address","name":"recipient","indexed":false},{"type":"int24","name":"tickLower","indexed":true},{"type":"int24","name":"tickUpper","indexed":true},{"type":"uint128","name":"amount0","indexed":false},{"type":"uint128","name":"amount1","indexed":false}]},{"type":"event","anonymous":false,"name":"CollectProtocol","inputs":[{"type":"address","name":"sender","indexed":true},{"type":"address","name":"recipient","indexed":true},{"type":"uint128","name":"amount0","indexed":false},{"type":"uint128","name":"amount1","indexed":false}]},{"type":"event","anonymous":false,"name":"Flash","inputs":[{"type":"address","name":"sender","indexed":true},{"type":"address","name":"recipient","indexed":true},{"type":"uint256","name":"amount0","indexed":false},{"type":"uint256","name":"amount1","indexed":false},{"type":"uint256","name":"paid0","indexed":false},{"type":"uint256","name":"paid1","indexed":false}]},{"type":"event","anonymous":false,"name":"IncreaseObservationCardinalityNext","inputs":[{"type":"uint16","name":"observationCardinalityNextOld","indexed":false},{"type":"uint16","name":"observationCardinalityNextNew","indexed":false}]},{"type":"event","anonymous":false,"name":"Initialize","inputs":[{"type":"uint160","name":"sqrtPriceX96","indexed":false},{"type":"int24","name":"tick","indexed":false}]},{"type":"event","anonymous":false,"name":"Mint","inputs":[{"type":"address","name":"sender","indexed":false},{"type":"address","name":"owner","indexed":true},{"type":"int24","name":"tickLower","indexed":true},{"type":"int24","name":"tickUpper","indexed":true},{"type":"uint128","name":"amount","indexed":false},{"type":"uint256","name":"amount0","indexed":false},{"type":"uint256","name":"amount1","indexed":false}]},{"type":"event","anonymous":false,"name":"SetFeeProtocol","inputs":[{"type":"uint8","name":"feeProtocol0Old","indexed":false},{"type":"uint8","name":"feeProtocol1Old","indexed":false},{"type":"uint8","name":"feeProtocol0New","indexed":false},{"type":"uint8","name":"feeProtocol1New","indexed":false}]},{"type":"event","anonymous":false,"name":"Swap","inputs":[{"type":"address","name":"sender","indexed":true},{"type":"address","name":"recipient","indexed":true},{"type":"int256","name":"amount0","indexed":false},{"type":"int256","name":"amount1","indexed":false},{"type":"uint160","name":"sqrtPriceX96","indexed":false},{"type":"uint128","name":"liquidity","indexed":false},{"type":"int24","name":"tick","indexed":false}]},{"type":"function","name":"burn","constant":false,"payable":false,"inputs":[{"type":"int24","name":"tickLower"},{"type":"int24","name":"tickUpper"},{"type":"uint128","name":"amount"}],"outputs":[{"type":"uint256","name":"amount0"},{"type":"uint256","name":"amount1"}]},{"type":"function","name":"collect","constant":false,"payable":false,"inputs":[{"type":"address","name":"recipient"},{"type":"int24","name":"tickLower"},{"type":"int24","name":"tickUpper"},{"type":"uint128","name":"amount0Requested"},{"type":"uint128","name":"amount1Requested"}],"outputs":[{"type":"uint128","name":"amount0"},{"type":"uint128","name":"amount1"}]},{"type":"function","name":"collectProtocol","constant":false,"payable":false,"inputs":[{"type":"address","name":"recipient"},{"type":"uint128","name":"amount0Requested"},{"type":"uint128","name":"amount1Requested"}],"outputs":[{"type":"uint128","name":"amount0"},{"type":"uint128","name":"amount1"}]},{"type":"function","name":"factory","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"address"}]},{"type":"function","name":"fee","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"uint24"}]},{"type":"function","name":"feeGrowthGlobal0X128","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"uint256"}]},{"type":"function","name":"feeGrowthGlobal1X128","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"uint256"}]},{"type":"function","name":"flash","constant":false,"payable":false,"inputs":[{"type":"address","name":"recipient"},{"type":"uint256","name":"amount0"},{"type":"uint256","name":"amount1"},{"type":"bytes","name":"data"}],"outputs":[]},{"type":"function","name":"increaseObservationCardinalityNext","constant":false,"payable":false,"inputs":[{"type":"uint16","name":"observationCardinalityNext"}],"outputs":[]},{"type":"function","name":"initialize","constant":false,"payable":false,"inputs":[{"type":"uint160","name":"sqrtPriceX96"}],"outputs":[]},{"type":"function","name":"liquidity","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"uint128"}]},{"type":"function","name":"maxLiquidityPerTick","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"uint128"}]},{"type":"function","name":"mint","constant":false,"payable":false,"inputs":[{"type":"address","name":"recipient"},{"type":"int24","name":"tickLower"},{"type":"int24","name":"tickUpper"},{"type":"uint128","name":"amount"},{"type":"bytes","name":"data"}],"outputs":[{"type":"uint256","name":"amount0"},{"type":"uint256","name":"amount1"}]},{"type":"function","name":"observations","constant":true,"stateMutability":"view","payable":false,"inputs":[{"type":"uint256","name":"index"}],"outputs":[{"type":"uint32","name":"blockTimestamp"},{"type":"int56","name":"tickCumulative"},{"type":"uint160","name":"secondsPerLiquidityCumulativeX128"},{"type":"bool","name":"initialized"}]},{"type":"function","name":"observe","constant":true,"stateMutability":"view","payable":false,"inputs":[{"type":"uint32[]","name":"secondsAgos"}],"outputs":[{"type":"int56[]","name":"tickCumulatives"},{"type":"uint160[]","name":"secondsPerLiquidityCumulativeX128s"}]},{"type":"function","name":"positions","constant":true,"stateMutability":"view","payable":false,"inputs":[{"type":"bytes32","name":"key"}],"outputs":[{"type":"uint128","name":"_liquidity"},{"type":"uint256","name":"feeGrowthInside0LastX128"},{"type":"uint256","name":"feeGrowthInside1LastX128"},{"type":"uint128","name":"tokensOwed0"},{"type":"uint128","name":"tokensOwed1"}]},{"type":"function","name":"protocolFees","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"uint128","name":"token0"},{"type":"uint128","name":"token1"}]},{"type":"function","name":"setFeeProtocol","constant":false,"payable":false,"inputs":[{"type":"uint8","name":"feeProtocol0"},{"type":"uint8","name":"feeProtocol1"}],"outputs":[]},{"type":"function","name":"slot0","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"uint160","name":"sqrtPriceX96"},{"type":"int24","name":"tick"},{"type":"uint16","name":"observationIndex"},{"type":"uint16","name":"observationCardinality"},{"type":"uint16","name":"observationCardinalityNext"},{"type":"uint8","name":"feeProtocol"},{"type":"bool","name":"unlocked"}]},{"type":"function","name":"snapshotCumulativesInside","constant":true,"stateMutability":"view","payable":false,"inputs":[{"type":"int24","name":"tickLower"},{"type":"int24","name":"tickUpper"}],"outputs":[{"type":"int56","name":"tickCumulativeInside"},{"type":"uint160","name":"secondsPerLiquidityInsideX128"},{"type":"uint32","name":"secondsInside"}]},{"type":"function","name":"swap","constant":false,"payable":false,"inputs":[{"type":"address","name":"recipient"},{"type":"bool","name":"zeroForOne"},{"type":"int256","name":"amountSpecified"},{"type":"uint160","name":"sqrtPriceLimitX96"},{"type":"bytes","name":"data"}],"outputs":[{"type":"int256","name":"amount0"},{"type":"int256","name":"amount1"}]},{"type":"function","name":"tickBitmap","constant":true,"stateMutability":"view","payable":false,"inputs":[{"type":"int16","name":"wordPosition"}],"outputs":[{"type":"uint256"}]},{"type":"function","name":"tickSpacing","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"int24"}]},{"type":"function","name":"ticks","constant":true,"stateMutability":"view","payable":false,"inputs":[{"type":"int24","name":"tick"}],"outputs":[{"type":"uint128","name":"liquidityGross"},{"type":"int128","name":"liquidityNet"},{"type":"uint256","name":"feeGrowthOutside0X128"},{"type":"uint256","name":"feeGrowthOutside1X128"},{"type":"int56","name":"tickCumulativeOutside"},{"type":"uint160","name":"secondsPerLiquidityOutsideX128"},{"type":"uint32","name":"secondsOutside"},{"type":"bool","name":"initialized"}]},{"type":"function","name":"token0","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"address"}]},{"type":"function","name":"token1","constant":true,"stateMutability":"view","payable":false,"inputs":[],"outputs":[{"type":"address"}]}]

export const abi = new ethers.utils.Interface(rawAbi);
export const multicallAbi = new ethers.utils.Interface(rawMulticallAbi);

export type Burn0Event = ([owner: string, tickLower: number, tickUpper: number, amount: ethers.BigNumber, amount0: ethers.BigNumber, amount1: ethers.BigNumber] & {owner: string, tickLower: number, tickUpper: number, amount: ethers.BigNumber, amount0: ethers.BigNumber, amount1: ethers.BigNumber})

export type Collect0Event = ([owner: string, recipient: string, tickLower: number, tickUpper: number, amount0: ethers.BigNumber, amount1: ethers.BigNumber] & {owner: string, recipient: string, tickLower: number, tickUpper: number, amount0: ethers.BigNumber, amount1: ethers.BigNumber})

export type CollectProtocol0Event = ([sender: string, recipient: string, amount0: ethers.BigNumber, amount1: ethers.BigNumber] & {sender: string, recipient: string, amount0: ethers.BigNumber, amount1: ethers.BigNumber})

export type Flash0Event = ([sender: string, recipient: string, amount0: ethers.BigNumber, amount1: ethers.BigNumber, paid0: ethers.BigNumber, paid1: ethers.BigNumber] & {sender: string, recipient: string, amount0: ethers.BigNumber, amount1: ethers.BigNumber, paid0: ethers.BigNumber, paid1: ethers.BigNumber})

export type IncreaseObservationCardinalityNext0Event = ([observationCardinalityNextOld: number, observationCardinalityNextNew: number] & {observationCardinalityNextOld: number, observationCardinalityNextNew: number})

export type Initialize0Event = ([sqrtPriceX96: ethers.BigNumber, tick: number] & {sqrtPriceX96: ethers.BigNumber, tick: number})

export type Mint0Event = ([sender: string, owner: string, tickLower: number, tickUpper: number, amount: ethers.BigNumber, amount0: ethers.BigNumber, amount1: ethers.BigNumber] & {sender: string, owner: string, tickLower: number, tickUpper: number, amount: ethers.BigNumber, amount0: ethers.BigNumber, amount1: ethers.BigNumber})

export type SetFeeProtocol0Event = ([feeProtocol0Old: number, feeProtocol1Old: number, feeProtocol0New: number, feeProtocol1New: number] & {feeProtocol0Old: number, feeProtocol1Old: number, feeProtocol0New: number, feeProtocol1New: number})

export type Swap0Event = ([sender: string, recipient: string, amount0: ethers.BigNumber, amount1: ethers.BigNumber, sqrtPriceX96: ethers.BigNumber, liquidity: ethers.BigNumber, tick: number] & {sender: string, recipient: string, amount0: ethers.BigNumber, amount1: ethers.BigNumber, sqrtPriceX96: ethers.BigNumber, liquidity: ethers.BigNumber, tick: number})

class Events {
  private readonly _abi = abi

  'Burn(address,int24,int24,uint128,uint256,uint256)' = {
    topic: this._abi.getEventTopic('Burn(address,int24,int24,uint128,uint256,uint256)'),
    decode: (data: EvmLog): Burn0Event => this._abi.decodeEventLog('Burn(address,int24,int24,uint128,uint256,uint256)', data.data, data.topics) as any
  }

  Burn = this['Burn(address,int24,int24,uint128,uint256,uint256)']

  'Collect(address,address,int24,int24,uint128,uint128)' = {
    topic: this._abi.getEventTopic('Collect(address,address,int24,int24,uint128,uint128)'),
    decode: (data: EvmLog): Collect0Event => this._abi.decodeEventLog('Collect(address,address,int24,int24,uint128,uint128)', data.data, data.topics) as any
  }

  Collect = this['Collect(address,address,int24,int24,uint128,uint128)']

  'CollectProtocol(address,address,uint128,uint128)' = {
    topic: this._abi.getEventTopic('CollectProtocol(address,address,uint128,uint128)'),
    decode: (data: EvmLog): CollectProtocol0Event => this._abi.decodeEventLog('CollectProtocol(address,address,uint128,uint128)', data.data, data.topics) as any
  }

  CollectProtocol = this['CollectProtocol(address,address,uint128,uint128)']

  'Flash(address,address,uint256,uint256,uint256,uint256)' = {
    topic: this._abi.getEventTopic('Flash(address,address,uint256,uint256,uint256,uint256)'),
    decode: (data: EvmLog): Flash0Event => this._abi.decodeEventLog('Flash(address,address,uint256,uint256,uint256,uint256)', data.data, data.topics) as any
  }

  Flash = this['Flash(address,address,uint256,uint256,uint256,uint256)']

  'IncreaseObservationCardinalityNext(uint16,uint16)' = {
    topic: this._abi.getEventTopic('IncreaseObservationCardinalityNext(uint16,uint16)'),
    decode: (data: EvmLog): IncreaseObservationCardinalityNext0Event => this._abi.decodeEventLog('IncreaseObservationCardinalityNext(uint16,uint16)', data.data, data.topics) as any
  }

  IncreaseObservationCardinalityNext = this['IncreaseObservationCardinalityNext(uint16,uint16)']

  'Initialize(uint160,int24)' = {
    topic: this._abi.getEventTopic('Initialize(uint160,int24)'),
    decode: (data: EvmLog): Initialize0Event => this._abi.decodeEventLog('Initialize(uint160,int24)', data.data, data.topics) as any
  }

  Initialize = this['Initialize(uint160,int24)']

  'Mint(address,address,int24,int24,uint128,uint256,uint256)' = {
    topic: this._abi.getEventTopic('Mint(address,address,int24,int24,uint128,uint256,uint256)'),
    decode: (data: EvmLog): Mint0Event => this._abi.decodeEventLog('Mint(address,address,int24,int24,uint128,uint256,uint256)', data.data, data.topics) as any
  }

  Mint = this['Mint(address,address,int24,int24,uint128,uint256,uint256)']

  'SetFeeProtocol(uint8,uint8,uint8,uint8)' = {
    topic: this._abi.getEventTopic('SetFeeProtocol(uint8,uint8,uint8,uint8)'),
    decode: (data: EvmLog): SetFeeProtocol0Event => this._abi.decodeEventLog('SetFeeProtocol(uint8,uint8,uint8,uint8)', data.data, data.topics) as any
  }

  SetFeeProtocol = this['SetFeeProtocol(uint8,uint8,uint8,uint8)']

  'Swap(address,address,int256,int256,uint160,uint128,int24)' = {
    topic: this._abi.getEventTopic('Swap(address,address,int256,int256,uint160,uint128,int24)'),
    decode: (data: EvmLog): Swap0Event => this._abi.decodeEventLog('Swap(address,address,int256,int256,uint160,uint128,int24)', data.data, data.topics) as any
  }

  Swap = this['Swap(address,address,int256,int256,uint160,uint128,int24)']
}

export const events = new Events()

export type Burn0Function = ([tickLower: number, tickUpper: number, amount: ethers.BigNumber] & {tickLower: number, tickUpper: number, amount: ethers.BigNumber})

export type Collect0Function = ([recipient: string, tickLower: number, tickUpper: number, amount0Requested: ethers.BigNumber, amount1Requested: ethers.BigNumber] & {recipient: string, tickLower: number, tickUpper: number, amount0Requested: ethers.BigNumber, amount1Requested: ethers.BigNumber})

export type CollectProtocol0Function = ([recipient: string, amount0Requested: ethers.BigNumber, amount1Requested: ethers.BigNumber] & {recipient: string, amount0Requested: ethers.BigNumber, amount1Requested: ethers.BigNumber})

export type Flash0Function = ([recipient: string, amount0: ethers.BigNumber, amount1: ethers.BigNumber, data: string] & {recipient: string, amount0: ethers.BigNumber, amount1: ethers.BigNumber, data: string})

export type IncreaseObservationCardinalityNext0Function = ([observationCardinalityNext: number] & {observationCardinalityNext: number})

export type Initialize0Function = ([sqrtPriceX96: ethers.BigNumber] & {sqrtPriceX96: ethers.BigNumber})

export type Mint0Function = ([recipient: string, tickLower: number, tickUpper: number, amount: ethers.BigNumber, data: string] & {recipient: string, tickLower: number, tickUpper: number, amount: ethers.BigNumber, data: string})

export type SetFeeProtocol0Function = ([feeProtocol0: number, feeProtocol1: number] & {feeProtocol0: number, feeProtocol1: number})

export type Swap0Function = ([recipient: string, zeroForOne: boolean, amountSpecified: ethers.BigNumber, sqrtPriceLimitX96: ethers.BigNumber, data: string] & {recipient: string, zeroForOne: boolean, amountSpecified: ethers.BigNumber, sqrtPriceLimitX96: ethers.BigNumber, data: string})

class Functions {
  private readonly _abi = abi

  'burn(int24,int24,uint128)' = {
    sighash: abi.getSighash('burn(int24,int24,uint128)'),
    decode: (data: EvmTransaction | string): Burn0Function => this._abi.decodeFunctionData('burn(int24,int24,uint128)', typeof data === 'string' ? data : data.input) as any
  }

  burn = this['burn(int24,int24,uint128)']

  'collect(address,int24,int24,uint128,uint128)' = {
    sighash: abi.getSighash('collect(address,int24,int24,uint128,uint128)'),
    decode: (data: EvmTransaction | string): Collect0Function => this._abi.decodeFunctionData('collect(address,int24,int24,uint128,uint128)', typeof data === 'string' ? data : data.input) as any
  }

  collect = this['collect(address,int24,int24,uint128,uint128)']

  'collectProtocol(address,uint128,uint128)' = {
    sighash: abi.getSighash('collectProtocol(address,uint128,uint128)'),
    decode: (data: EvmTransaction | string): CollectProtocol0Function => this._abi.decodeFunctionData('collectProtocol(address,uint128,uint128)', typeof data === 'string' ? data : data.input) as any
  }

  collectProtocol = this['collectProtocol(address,uint128,uint128)']

  'flash(address,uint256,uint256,bytes)' = {
    sighash: abi.getSighash('flash(address,uint256,uint256,bytes)'),
    decode: (data: EvmTransaction | string): Flash0Function => this._abi.decodeFunctionData('flash(address,uint256,uint256,bytes)', typeof data === 'string' ? data : data.input) as any
  }

  flash = this['flash(address,uint256,uint256,bytes)']

  'increaseObservationCardinalityNext(uint16)' = {
    sighash: abi.getSighash('increaseObservationCardinalityNext(uint16)'),
    decode: (data: EvmTransaction | string): IncreaseObservationCardinalityNext0Function => this._abi.decodeFunctionData('increaseObservationCardinalityNext(uint16)', typeof data === 'string' ? data : data.input) as any
  }

  increaseObservationCardinalityNext = this['increaseObservationCardinalityNext(uint16)']

  'initialize(uint160)' = {
    sighash: abi.getSighash('initialize(uint160)'),
    decode: (data: EvmTransaction | string): Initialize0Function => this._abi.decodeFunctionData('initialize(uint160)', typeof data === 'string' ? data : data.input) as any
  }

  initialize = this['initialize(uint160)']

  'mint(address,int24,int24,uint128,bytes)' = {
    sighash: abi.getSighash('mint(address,int24,int24,uint128,bytes)'),
    decode: (data: EvmTransaction | string): Mint0Function => this._abi.decodeFunctionData('mint(address,int24,int24,uint128,bytes)', typeof data === 'string' ? data : data.input) as any
  }

  mint = this['mint(address,int24,int24,uint128,bytes)']

  'setFeeProtocol(uint8,uint8)' = {
    sighash: abi.getSighash('setFeeProtocol(uint8,uint8)'),
    decode: (data: EvmTransaction | string): SetFeeProtocol0Function => this._abi.decodeFunctionData('setFeeProtocol(uint8,uint8)', typeof data === 'string' ? data : data.input) as any
  }

  setFeeProtocol = this['setFeeProtocol(uint8,uint8)']

  'swap(address,bool,int256,uint160,bytes)' = {
    sighash: abi.getSighash('swap(address,bool,int256,uint160,bytes)'),
    decode: (data: EvmTransaction | string): Swap0Function => this._abi.decodeFunctionData('swap(address,bool,int256,uint160,bytes)', typeof data === 'string' ? data : data.input) as any
  }

  swap = this['swap(address,bool,int256,uint160,bytes)']
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

  'factory()' = {
    call: (): Promise<string> => this.call('factory()', []),
    tryCall: (): Promise<Result<string>> => this.tryCall('factory()', [])
  }

  factory = this['factory()']

  'fee()' = {
    call: (): Promise<number> => this.call('fee()', []),
    tryCall: (): Promise<Result<number>> => this.tryCall('fee()', [])
  }

  fee = this['fee()']

  'feeGrowthGlobal0X128()' = {
    call: (): Promise<ethers.BigNumber> => this.call('feeGrowthGlobal0X128()', []),
    tryCall: (): Promise<Result<ethers.BigNumber>> => this.tryCall('feeGrowthGlobal0X128()', [])
  }

  feeGrowthGlobal0X128 = this['feeGrowthGlobal0X128()']

  'feeGrowthGlobal1X128()' = {
    call: (): Promise<ethers.BigNumber> => this.call('feeGrowthGlobal1X128()', []),
    tryCall: (): Promise<Result<ethers.BigNumber>> => this.tryCall('feeGrowthGlobal1X128()', [])
  }

  feeGrowthGlobal1X128 = this['feeGrowthGlobal1X128()']

  'liquidity()' = {
    call: (): Promise<ethers.BigNumber> => this.call('liquidity()', []),
    tryCall: (): Promise<Result<ethers.BigNumber>> => this.tryCall('liquidity()', [])
  }

  liquidity = this['liquidity()']

  'maxLiquidityPerTick()' = {
    call: (): Promise<ethers.BigNumber> => this.call('maxLiquidityPerTick()', []),
    tryCall: (): Promise<Result<ethers.BigNumber>> => this.tryCall('maxLiquidityPerTick()', [])
  }

  maxLiquidityPerTick = this['maxLiquidityPerTick()']

  'observations(uint256)' = {
    call: (index: ethers.BigNumber): Promise<([blockTimestamp: number, tickCumulative: ethers.BigNumber, secondsPerLiquidityCumulativeX128: ethers.BigNumber, initialized: boolean] & {blockTimestamp: number, tickCumulative: ethers.BigNumber, secondsPerLiquidityCumulativeX128: ethers.BigNumber, initialized: boolean})> => this.call('observations(uint256)', [index]),
    tryCall: (index: ethers.BigNumber): Promise<Result<([blockTimestamp: number, tickCumulative: ethers.BigNumber, secondsPerLiquidityCumulativeX128: ethers.BigNumber, initialized: boolean] & {blockTimestamp: number, tickCumulative: ethers.BigNumber, secondsPerLiquidityCumulativeX128: ethers.BigNumber, initialized: boolean})>> => this.tryCall('observations(uint256)', [index])
  }

  observations = this['observations(uint256)']

  'observe(uint32[])' = {
    call: (secondsAgos: Array<number>): Promise<([tickCumulatives: Array<ethers.BigNumber>, secondsPerLiquidityCumulativeX128s: Array<ethers.BigNumber>] & {tickCumulatives: Array<ethers.BigNumber>, secondsPerLiquidityCumulativeX128s: Array<ethers.BigNumber>})> => this.call('observe(uint32[])', [secondsAgos]),
    tryCall: (secondsAgos: Array<number>): Promise<Result<([tickCumulatives: Array<ethers.BigNumber>, secondsPerLiquidityCumulativeX128s: Array<ethers.BigNumber>] & {tickCumulatives: Array<ethers.BigNumber>, secondsPerLiquidityCumulativeX128s: Array<ethers.BigNumber>})>> => this.tryCall('observe(uint32[])', [secondsAgos])
  }

  observe = this['observe(uint32[])']

  'positions(bytes32)' = {
    call: (key: string): Promise<([_liquidity: ethers.BigNumber, feeGrowthInside0LastX128: ethers.BigNumber, feeGrowthInside1LastX128: ethers.BigNumber, tokensOwed0: ethers.BigNumber, tokensOwed1: ethers.BigNumber] & {_liquidity: ethers.BigNumber, feeGrowthInside0LastX128: ethers.BigNumber, feeGrowthInside1LastX128: ethers.BigNumber, tokensOwed0: ethers.BigNumber, tokensOwed1: ethers.BigNumber})> => this.call('positions(bytes32)', [key]),
    tryCall: (key: string): Promise<Result<([_liquidity: ethers.BigNumber, feeGrowthInside0LastX128: ethers.BigNumber, feeGrowthInside1LastX128: ethers.BigNumber, tokensOwed0: ethers.BigNumber, tokensOwed1: ethers.BigNumber] & {_liquidity: ethers.BigNumber, feeGrowthInside0LastX128: ethers.BigNumber, feeGrowthInside1LastX128: ethers.BigNumber, tokensOwed0: ethers.BigNumber, tokensOwed1: ethers.BigNumber})>> => this.tryCall('positions(bytes32)', [key])
  }

  positions = this['positions(bytes32)']

  'protocolFees()' = {
    call: (): Promise<([token0: ethers.BigNumber, token1: ethers.BigNumber] & {token0: ethers.BigNumber, token1: ethers.BigNumber})> => this.call('protocolFees()', []),
    tryCall: (): Promise<Result<([token0: ethers.BigNumber, token1: ethers.BigNumber] & {token0: ethers.BigNumber, token1: ethers.BigNumber})>> => this.tryCall('protocolFees()', [])
  }

  protocolFees = this['protocolFees()']

  'slot0()' = {
    call: (): Promise<([sqrtPriceX96: ethers.BigNumber, tick: number, observationIndex: number, observationCardinality: number, observationCardinalityNext: number, feeProtocol: number, unlocked: boolean] & {sqrtPriceX96: ethers.BigNumber, tick: number, observationIndex: number, observationCardinality: number, observationCardinalityNext: number, feeProtocol: number, unlocked: boolean})> => this.call('slot0()', []),
    tryCall: (): Promise<Result<([sqrtPriceX96: ethers.BigNumber, tick: number, observationIndex: number, observationCardinality: number, observationCardinalityNext: number, feeProtocol: number, unlocked: boolean] & {sqrtPriceX96: ethers.BigNumber, tick: number, observationIndex: number, observationCardinality: number, observationCardinalityNext: number, feeProtocol: number, unlocked: boolean})>> => this.tryCall('slot0()', [])
  }

  slot0 = this['slot0()']

  'snapshotCumulativesInside(int24,int24)' = {
    call: (tickLower: number, tickUpper: number): Promise<([tickCumulativeInside: ethers.BigNumber, secondsPerLiquidityInsideX128: ethers.BigNumber, secondsInside: number] & {tickCumulativeInside: ethers.BigNumber, secondsPerLiquidityInsideX128: ethers.BigNumber, secondsInside: number})> => this.call('snapshotCumulativesInside(int24,int24)', [tickLower, tickUpper]),
    tryCall: (tickLower: number, tickUpper: number): Promise<Result<([tickCumulativeInside: ethers.BigNumber, secondsPerLiquidityInsideX128: ethers.BigNumber, secondsInside: number] & {tickCumulativeInside: ethers.BigNumber, secondsPerLiquidityInsideX128: ethers.BigNumber, secondsInside: number})>> => this.tryCall('snapshotCumulativesInside(int24,int24)', [tickLower, tickUpper])
  }

  snapshotCumulativesInside = this['snapshotCumulativesInside(int24,int24)']

  'tickBitmap(int16)' = {
    call: (wordPosition: number): Promise<ethers.BigNumber> => this.call('tickBitmap(int16)', [wordPosition]),
    tryCall: (wordPosition: number): Promise<Result<ethers.BigNumber>> => this.tryCall('tickBitmap(int16)', [wordPosition])
  }

  tickBitmap = this['tickBitmap(int16)']

  'tickSpacing()' = {
    call: (): Promise<number> => this.call('tickSpacing()', []),
    tryCall: (): Promise<Result<number>> => this.tryCall('tickSpacing()', [])
  }

  tickSpacing = this['tickSpacing()']

  'ticks(int24)' = {
    call: (tick: number): Promise<([liquidityGross: ethers.BigNumber, liquidityNet: ethers.BigNumber, feeGrowthOutside0X128: ethers.BigNumber, feeGrowthOutside1X128: ethers.BigNumber, tickCumulativeOutside: ethers.BigNumber, secondsPerLiquidityOutsideX128: ethers.BigNumber, secondsOutside: number, initialized: boolean] & {liquidityGross: ethers.BigNumber, liquidityNet: ethers.BigNumber, feeGrowthOutside0X128: ethers.BigNumber, feeGrowthOutside1X128: ethers.BigNumber, tickCumulativeOutside: ethers.BigNumber, secondsPerLiquidityOutsideX128: ethers.BigNumber, secondsOutside: number, initialized: boolean})> => this.call('ticks(int24)', [tick]),
    tryCall: (tick: number): Promise<Result<([liquidityGross: ethers.BigNumber, liquidityNet: ethers.BigNumber, feeGrowthOutside0X128: ethers.BigNumber, feeGrowthOutside1X128: ethers.BigNumber, tickCumulativeOutside: ethers.BigNumber, secondsPerLiquidityOutsideX128: ethers.BigNumber, secondsOutside: number, initialized: boolean] & {liquidityGross: ethers.BigNumber, liquidityNet: ethers.BigNumber, feeGrowthOutside0X128: ethers.BigNumber, feeGrowthOutside1X128: ethers.BigNumber, tickCumulativeOutside: ethers.BigNumber, secondsPerLiquidityOutsideX128: ethers.BigNumber, secondsOutside: number, initialized: boolean})>> => this.tryCall('ticks(int24)', [tick])
  }

  ticks = this['ticks(int24)']

  'token0()' = {
    call: (): Promise<string> => this.call('token0()', []),
    tryCall: (): Promise<Result<string>> => this.tryCall('token0()', [])
  }

  token0 = this['token0()']

  'token1()' = {
    call: (): Promise<string> => this.call('token1()', []),
    tryCall: (): Promise<Result<string>> => this.tryCall('token1()', [])
  }

  token1 = this['token1()']

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

  'factory()' = {
    call: (args: string[]): Promise<string[]> => this.call('factory()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<string>[]> => this.tryCall('factory()', args.map((arg) => [arg, []]))
  }

  factory = this['factory()']

  'fee()' = {
    call: (args: string[]): Promise<number[]> => this.call('fee()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<number>[]> => this.tryCall('fee()', args.map((arg) => [arg, []]))
  }

  fee = this['fee()']

  'feeGrowthGlobal0X128()' = {
    call: (args: string[]): Promise<ethers.BigNumber[]> => this.call('feeGrowthGlobal0X128()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<ethers.BigNumber>[]> => this.tryCall('feeGrowthGlobal0X128()', args.map((arg) => [arg, []]))
  }

  feeGrowthGlobal0X128 = this['feeGrowthGlobal0X128()']

  'feeGrowthGlobal1X128()' = {
    call: (args: string[]): Promise<ethers.BigNumber[]> => this.call('feeGrowthGlobal1X128()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<ethers.BigNumber>[]> => this.tryCall('feeGrowthGlobal1X128()', args.map((arg) => [arg, []]))
  }

  feeGrowthGlobal1X128 = this['feeGrowthGlobal1X128()']

  'liquidity()' = {
    call: (args: string[]): Promise<ethers.BigNumber[]> => this.call('liquidity()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<ethers.BigNumber>[]> => this.tryCall('liquidity()', args.map((arg) => [arg, []]))
  }

  liquidity = this['liquidity()']

  'maxLiquidityPerTick()' = {
    call: (args: string[]): Promise<ethers.BigNumber[]> => this.call('maxLiquidityPerTick()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<ethers.BigNumber>[]> => this.tryCall('maxLiquidityPerTick()', args.map((arg) => [arg, []]))
  }

  maxLiquidityPerTick = this['maxLiquidityPerTick()']

  'observations(uint256)' = {
    call: (args: [string, [index: ethers.BigNumber]][]): Promise<([blockTimestamp: number, tickCumulative: ethers.BigNumber, secondsPerLiquidityCumulativeX128: ethers.BigNumber, initialized: boolean] & {blockTimestamp: number, tickCumulative: ethers.BigNumber, secondsPerLiquidityCumulativeX128: ethers.BigNumber, initialized: boolean})[]> => this.call('observations(uint256)', args),
    tryCall: (args: [string, [index: ethers.BigNumber]][]): Promise<Result<([blockTimestamp: number, tickCumulative: ethers.BigNumber, secondsPerLiquidityCumulativeX128: ethers.BigNumber, initialized: boolean] & {blockTimestamp: number, tickCumulative: ethers.BigNumber, secondsPerLiquidityCumulativeX128: ethers.BigNumber, initialized: boolean})>[]> => this.tryCall('observations(uint256)', args)
  }

  observations = this['observations(uint256)']

  'observe(uint32[])' = {
    call: (args: [string, [secondsAgos: Array<number>]][]): Promise<([tickCumulatives: Array<ethers.BigNumber>, secondsPerLiquidityCumulativeX128s: Array<ethers.BigNumber>] & {tickCumulatives: Array<ethers.BigNumber>, secondsPerLiquidityCumulativeX128s: Array<ethers.BigNumber>})[]> => this.call('observe(uint32[])', args),
    tryCall: (args: [string, [secondsAgos: Array<number>]][]): Promise<Result<([tickCumulatives: Array<ethers.BigNumber>, secondsPerLiquidityCumulativeX128s: Array<ethers.BigNumber>] & {tickCumulatives: Array<ethers.BigNumber>, secondsPerLiquidityCumulativeX128s: Array<ethers.BigNumber>})>[]> => this.tryCall('observe(uint32[])', args)
  }

  observe = this['observe(uint32[])']

  'positions(bytes32)' = {
    call: (args: [string, [key: string]][]): Promise<([_liquidity: ethers.BigNumber, feeGrowthInside0LastX128: ethers.BigNumber, feeGrowthInside1LastX128: ethers.BigNumber, tokensOwed0: ethers.BigNumber, tokensOwed1: ethers.BigNumber] & {_liquidity: ethers.BigNumber, feeGrowthInside0LastX128: ethers.BigNumber, feeGrowthInside1LastX128: ethers.BigNumber, tokensOwed0: ethers.BigNumber, tokensOwed1: ethers.BigNumber})[]> => this.call('positions(bytes32)', args),
    tryCall: (args: [string, [key: string]][]): Promise<Result<([_liquidity: ethers.BigNumber, feeGrowthInside0LastX128: ethers.BigNumber, feeGrowthInside1LastX128: ethers.BigNumber, tokensOwed0: ethers.BigNumber, tokensOwed1: ethers.BigNumber] & {_liquidity: ethers.BigNumber, feeGrowthInside0LastX128: ethers.BigNumber, feeGrowthInside1LastX128: ethers.BigNumber, tokensOwed0: ethers.BigNumber, tokensOwed1: ethers.BigNumber})>[]> => this.tryCall('positions(bytes32)', args)
  }

  positions = this['positions(bytes32)']

  'protocolFees()' = {
    call: (args: string[]): Promise<([token0: ethers.BigNumber, token1: ethers.BigNumber] & {token0: ethers.BigNumber, token1: ethers.BigNumber})[]> => this.call('protocolFees()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<([token0: ethers.BigNumber, token1: ethers.BigNumber] & {token0: ethers.BigNumber, token1: ethers.BigNumber})>[]> => this.tryCall('protocolFees()', args.map((arg) => [arg, []]))
  }

  protocolFees = this['protocolFees()']

  'slot0()' = {
    call: (args: string[]): Promise<([sqrtPriceX96: ethers.BigNumber, tick: number, observationIndex: number, observationCardinality: number, observationCardinalityNext: number, feeProtocol: number, unlocked: boolean] & {sqrtPriceX96: ethers.BigNumber, tick: number, observationIndex: number, observationCardinality: number, observationCardinalityNext: number, feeProtocol: number, unlocked: boolean})[]> => this.call('slot0()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<([sqrtPriceX96: ethers.BigNumber, tick: number, observationIndex: number, observationCardinality: number, observationCardinalityNext: number, feeProtocol: number, unlocked: boolean] & {sqrtPriceX96: ethers.BigNumber, tick: number, observationIndex: number, observationCardinality: number, observationCardinalityNext: number, feeProtocol: number, unlocked: boolean})>[]> => this.tryCall('slot0()', args.map((arg) => [arg, []]))
  }

  slot0 = this['slot0()']

  'snapshotCumulativesInside(int24,int24)' = {
    call: (args: [string, [tickLower: number, tickUpper: number]][]): Promise<([tickCumulativeInside: ethers.BigNumber, secondsPerLiquidityInsideX128: ethers.BigNumber, secondsInside: number] & {tickCumulativeInside: ethers.BigNumber, secondsPerLiquidityInsideX128: ethers.BigNumber, secondsInside: number})[]> => this.call('snapshotCumulativesInside(int24,int24)', args),
    tryCall: (args: [string, [tickLower: number, tickUpper: number]][]): Promise<Result<([tickCumulativeInside: ethers.BigNumber, secondsPerLiquidityInsideX128: ethers.BigNumber, secondsInside: number] & {tickCumulativeInside: ethers.BigNumber, secondsPerLiquidityInsideX128: ethers.BigNumber, secondsInside: number})>[]> => this.tryCall('snapshotCumulativesInside(int24,int24)', args)
  }

  snapshotCumulativesInside = this['snapshotCumulativesInside(int24,int24)']

  'tickBitmap(int16)' = {
    call: (args: [string, [wordPosition: number]][]): Promise<ethers.BigNumber[]> => this.call('tickBitmap(int16)', args),
    tryCall: (args: [string, [wordPosition: number]][]): Promise<Result<ethers.BigNumber>[]> => this.tryCall('tickBitmap(int16)', args)
  }

  tickBitmap = this['tickBitmap(int16)']

  'tickSpacing()' = {
    call: (args: string[]): Promise<number[]> => this.call('tickSpacing()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<number>[]> => this.tryCall('tickSpacing()', args.map((arg) => [arg, []]))
  }

  tickSpacing = this['tickSpacing()']

  'ticks(int24)' = {
    call: (args: [string, [tick: number]][]): Promise<([liquidityGross: ethers.BigNumber, liquidityNet: ethers.BigNumber, feeGrowthOutside0X128: ethers.BigNumber, feeGrowthOutside1X128: ethers.BigNumber, tickCumulativeOutside: ethers.BigNumber, secondsPerLiquidityOutsideX128: ethers.BigNumber, secondsOutside: number, initialized: boolean] & {liquidityGross: ethers.BigNumber, liquidityNet: ethers.BigNumber, feeGrowthOutside0X128: ethers.BigNumber, feeGrowthOutside1X128: ethers.BigNumber, tickCumulativeOutside: ethers.BigNumber, secondsPerLiquidityOutsideX128: ethers.BigNumber, secondsOutside: number, initialized: boolean})[]> => this.call('ticks(int24)', args),
    tryCall: (args: [string, [tick: number]][]): Promise<Result<([liquidityGross: ethers.BigNumber, liquidityNet: ethers.BigNumber, feeGrowthOutside0X128: ethers.BigNumber, feeGrowthOutside1X128: ethers.BigNumber, tickCumulativeOutside: ethers.BigNumber, secondsPerLiquidityOutsideX128: ethers.BigNumber, secondsOutside: number, initialized: boolean] & {liquidityGross: ethers.BigNumber, liquidityNet: ethers.BigNumber, feeGrowthOutside0X128: ethers.BigNumber, feeGrowthOutside1X128: ethers.BigNumber, tickCumulativeOutside: ethers.BigNumber, secondsPerLiquidityOutsideX128: ethers.BigNumber, secondsOutside: number, initialized: boolean})>[]> => this.tryCall('ticks(int24)', args)
  }

  ticks = this['ticks(int24)']

  'token0()' = {
    call: (args: string[]): Promise<string[]> => this.call('token0()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<string>[]> => this.tryCall('token0()', args.map((arg) => [arg, []]))
  }

  token0 = this['token0()']

  'token1()' = {
    call: (args: string[]): Promise<string[]> => this.call('token1()', args.map((arg) => [arg, []])),
    tryCall: (args: string[]): Promise<Result<string>[]> => this.tryCall('token1()', args.map((arg) => [arg, []]))
  }

  token1 = this['token1()']

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
