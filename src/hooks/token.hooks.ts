import { useAccount, useBalance, useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import { useCapabilities, useSendCalls, useWriteContracts } from "wagmi/experimental";
import { FormRow } from "../types";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { tokens } from "../configs/tokens.config";

const useTokenBalance = (selectedToken: typeof tokens.mainnet[number]) => {
    const { address } = useAccount();
    const { data: nativeBalance, } = useBalance({ address });
    const { data, ...readData } = useReadContract({
        abi: erc20Abi,
        address: selectedToken.address as `0x${string}`,
        functionName: "balanceOf",
        args: [address as `0x${string}`]
    });
    const { data: decimals } = useReadContract({
        abi: erc20Abi,
        address: selectedToken.address as `0x${string}`,
        functionName: "decimals",
    });
    const returnedData = data as bigint;

    return {
        tokenBalance: (selectedToken.address == "0x0000000000000000000000000000000000000000")
            ? (nativeBalance ? (parseInt(nativeBalance.value.toString()) / (10 ** 18)) : 0)
            : (returnedData ? (parseInt(returnedData.toString()) / (10 ** (decimals as number))) : 0),
        ...readData
    };
};

const useBatchPayout = (data: FormRow[], selectedToken: typeof tokens.mainnet[number]) => {
    const { address, chainId } = useAccount();
    const { writeContractsAsync, isPending: isWritePending, isSuccess: isWriteSuccess } = useWriteContracts();
    const { sendCallsAsync, isPending: isSendPending, isSuccess: isSendSuccess } = useSendCalls();
    const [txHash, setTxHash] = useState<string>();
    const [isPending, setIsPending] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Paymaster
    const { data: availableCapabilities } = useCapabilities({ account: address });
    const capabilities = useMemo(() => {
        if (!availableCapabilities || !chainId) return {};
        const capabilitiesForChain = availableCapabilities[chainId];
        if (
            capabilitiesForChain["paymasterService"] &&
            capabilitiesForChain["paymasterService"].supported
        ) {
            return {
                paymasterService: {
                    url: `${import.meta.env.VITE_APP_BACKEND_URL}/paymaster`,
                },
            };
        }
        return {};
    }, [availableCapabilities, chainId]);

    const { data: decimals } = useReadContract({
        abi: erc20Abi,
        address: selectedToken.address as `0x${string}`,
        functionName: "decimals",
    });

    const batchPayout = async () => {
        try {
            var tx;

            // NATIVE
            if (selectedToken.address == "0x0000000000000000000000000000000000000000") {
                const calls = data.map((row) => {
                    return {
                        to: row.wallet as `0x${string}`,
                        value: BigInt(parseFloat(row.amount) * (10 ** 18)),
                    }
                });

                tx = await sendCallsAsync({ calls, capabilities });
            }
            // ERC20
            else {
                const contractWrites = data.map((row) => {
                    return {
                        address: selectedToken.address as `0x${string}`,
                        abi: erc20Abi,
                        functionName: "transfer",
                        args: [row.wallet, BigInt(parseFloat(row.amount) * (10 ** (decimals as number)))],
                    }
                });

                tx = await writeContractsAsync({ contracts: contractWrites, capabilities });
            }
            console.log("Txn Hash: ", tx);
            setTxHash(tx);
        } catch (err) {
            console.error(err);
            toast.error("Payout failed!");
        }
    }

    useEffect(() => {
        setIsPending(isWritePending || isSendPending);
        setIsSuccess(isWriteSuccess || isSendSuccess);
    }, [isWritePending, isWriteSuccess, isSendPending, isSendSuccess]);

    return {
        batchPayout,
        txHash,
        isPending,
        isSuccess
    }
}

export {
    useTokenBalance,
    useBatchPayout
}