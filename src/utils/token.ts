import * as ERC20 from '../abi/ERC20'
import * as ERC20SymbolBytes from '../abi/ERC20SymbolBytes'
import * as ERC20NameBytes from '../abi/ERC20NameBytes'
import {StaticTokenDefinition} from './staticTokenDefinition'
import {BlockHandlerContext, decodeHex, LogHandlerContext} from '@subsquid/evm-processor'
import {MULTICALL_ADDRESS} from './constants'
import {removeNullBytes} from './tools'

export async function fetchTokensSymbol(ctx: BlockHandlerContext<unknown>, tokenAddresses: string[]) {
    const result = new Map<string, string>()

    // try types string and bytes32 for symbol
    let contract = new ERC20.MulticallContract(ctx, MULTICALL_ADDRESS)
    const addressesBytes: string[] = []
    await contract.symbol.tryCall(tokenAddresses).then((batch) =>
        batch.forEach((item, i) => {
            if (item.success) {
                result.set(tokenAddresses[i], removeNullBytes(item.value))
            } else {
                addressesBytes.push(tokenAddresses[i])
            }
        })
    )

    let contractBytes = new ERC20SymbolBytes.MulticallContract(ctx, MULTICALL_ADDRESS)
    const addressesStatic: string[] = []
    await contractBytes.symbol.tryCall(addressesBytes).then((batch) =>
        batch.forEach((item, i) => {
            if (item.success) {
                result.set(addressesBytes[i], removeNullBytes(item.value))
            } else {
                addressesStatic.push(addressesBytes[i])
            }
        })
    )

    for (const address of addressesStatic) {
        const value = StaticTokenDefinition.fromAddress(address)?.symbol
        if (value == null) ctx.log.warn(`Missing symbol for token ${address}`)

        result.set(address, value || 'unknown')
    }

    return result
}

export async function fetchTokensName(ctx: BlockHandlerContext<unknown>, tokenAddresses: string[]) {
    const result = new Map<string, string>()

    // try types string and bytes32 for name
    let contract = new ERC20.MulticallContract(ctx, MULTICALL_ADDRESS)
    const addressesBytes: string[] = []
    await contract.name.tryCall(tokenAddresses).then((batch) =>
        batch.forEach((item, i) => {
            if (item.success) {
                result.set(tokenAddresses[i], removeNullBytes(item.value))
            } else {
                addressesBytes.push(tokenAddresses[i])
            }
        })
    )

    let contractBytes = new ERC20NameBytes.MulticallContract(ctx, MULTICALL_ADDRESS)
    const addressesStatic: string[] = []
    await contractBytes.name.tryCall(addressesBytes).then((batch) =>
        batch.forEach((item, i) => {
            if (item.success) {
                result.set(addressesBytes[i], removeNullBytes(item.value))
            } else {
                addressesStatic.push(addressesBytes[i])
            }
        })
    )

    for (const address of addressesStatic) {
        const value = StaticTokenDefinition.fromAddress(address)?.name
        if (value == null) ctx.log.warn(`Missing name for token ${address}`)

        result.set(address, value || 'unknown')
    }

    return result
}

export async function fetchTokensTotalSupply(ctx: BlockHandlerContext<unknown>, tokenAddresses: string[]) {
    let contract = new ERC20.MulticallContract(ctx, MULTICALL_ADDRESS)

    return contract.totalSupply
        .tryCall(tokenAddresses)
        .then((bns) => new Map(bns.map((bn, i) => [tokenAddresses[i], bn.success ? bn.value.toBigInt() : 0n])))
}

export async function fetchTokensDecimals(ctx: BlockHandlerContext<unknown>, tokenAddresses: string[]) {
    let contract = new ERC20.MulticallContract(ctx, MULTICALL_ADDRESS)
    // try types uint8 for decimals
    return contract.decimals
        .tryCall(tokenAddresses)
        .then((ds) => new Map(ds.map((d, i) => [tokenAddresses[i], d.success ? d.value : 0])))
}
