const { network, ethers } = require("hardhat")
const { developmentChain, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    let vrfCoordinatorV2Address, subscriptionId

    /** Deploying the Mock Contract or setting the vrf Coordinator Contract */
    if (developmentChain.includes(network.name)) {
        const vrfCoordinatorMock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorMock.address
        const transactionResponse = await vrfCoordinatorMock.createSubscription()
        const transactioReciept = await transactionResponse.wait(1)
        subscriptionId = transactioReciept.events[0].args.subId

        await vrfCoordinatorMock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    /** --------------------------------------------------------------------------------------- */

    log("----------------------------------------------------")
    log("Deploying FundMe and waiting f or confirmations...😏😏😏🙂🙂")

    /**Constructor Arguments for Raffle contract */
    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]
    /**-------------------------------------------------------------------------------------------*/

    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    log(`Raffle deployed at ${raffle.address}`)

    if (!developmentChain.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        console.log("Verifying.......🥳🥳🥳🥳")
        await verify(raffle.address, args)
    }
}

module.exports.tags = ["all", "Raffle"]
