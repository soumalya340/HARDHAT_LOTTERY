const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts, network } = require("hardhat")

const { developmentChain, networkConfig } = require("../../helper-hardhat-config.js")

!developmentChain.includes(network.name)
    ? describe.skip
    : describe("Raffle", async function () {
          let raffle, vrfCoordinatorMock, raffleEntranceFee, deployer

          const chainId = network.config.chainId
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorMock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
          })

          describe("Constructor", async function () {
              it("It intializes the raffle correctly", async function () {
                  const raffleState = await raffle.getRaffleState()
                  const interval = await raffle.getInterval()

                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
          })
          describe("Enter Raffle", async function () {
              it("reverts when u don't pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEnter")
              })
              it("records players when they enter", async function () {
                  console.log("Hey")
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })
          })
      }) //for first describe block
