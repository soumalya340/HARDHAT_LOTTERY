const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts, network } = require("hardhat")

const { developmentChain, networkConfig } = require("../../helper-hardhat-config.js")

!developmentChain.includes(network.name)
    ? describe.skip
    : describe("Raffle", async function () {
          let raffle, vrfCoordinatorMock, raffleEntranceFee, deployer, interval

          const chainId = network.config.chainId
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorMock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("Constructor", function () {
              it("It intializes the raffle correctly", async function () {
                  const raffleState = await raffle.getRaffleState()

                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
          })
          /** IMPORTANT SECTION */
          describe("Enter Raffle", function () {
              it("reverts when u don't pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEnter")
              })
              it("records players when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })

              it("emits event on enter", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              }) //if a function emits event
              it("it doesn't allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep([])
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "RAFFLE__NotOpen"
                  )
              })
          })
          describe("checkUpkeep", function () {
              it("returns false if people haven't seen any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })
              it("returns false if raffle isn't Open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep("0x")
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(raffleState.toString(), "1")
                  assert.equal(upkeepNeeded, false)
              })
          })
          describe("performUpkeep", function () {
              it("it can only run if checkupkeep is true ", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep([])
                  assert(tx)
              })
              it("it reverts when checkupkeep is false ", async function () {
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpkeepNotNeeded"
                  )
              })
              it("updates the raffle state , emits an event , and calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await raffle.performUpkeep([])
                  const txReceipt = await txResponse.wait(1)
                  const requestId = txReceipt.events[1].args.requestId
                  const raffleState = await raffle.getRaffleState()
                  assert(requestId.toNumber() > 0)
                  assert(raffleState.toString() == "1")
              })
          })
          describe("fullfilRandomWords", () => {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })
              //   it("can only be called after performUpkeep ", async () => {
              //       await expect(
              //           vrfCoordinatorMock.fulfillRandomWords(0, raffle.address)
              //       ).to.be.revertedWith("nonexistent  request")
              //       //   await expect(
              //       //       vrfCoordinatorMock.fulfillRandomWords(1, raffle.address)
              //       //   ).to.be.revertedWith("nonexistent request")

              //   })
              /**MASSIVE PROMISE TEST */
              it("picks a winner , resets the lottery ,and sends money ", async () => {
                  const additionalEntrants = 3
                  const startingAccountIndex = 1
                  const accounts = await ethers.getSigners()
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i])
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      const startingTimestamp = await raffle.getLatestTimeStamp()

                      await new Promise(async (resolve, reject) => {
                          raffle.once("WinnerPicked", async () => {
                              console.log("Found the Event")
                              try {
                                  const recentWinner = await raffle.getRecentWinner()
                                  console.log(recentWinner)
                                  console.log(accounts[2].address)
                                  console.log(accounts[0].address)
                                  console.log(accounts[1].address)
                                  console.log(accounts[3].address)
                                  const raffleState = await raffle.getRaffleState()
                                  const endingTimeStamp = await raffle.getLatestTimeStamp()
                                  const numPlayers = raffleState.getNumberOfPlayers()

                                  assert.equal(numPlayers.toString(), "0")
                                  assert.equal(raffleState.toString(), "Open")
                                  assert.equal(endingTimeStamp > startingTimestamp)
                              } catch (e) {
                                  reject(e)
                              }
                              resolve()
                          })

                          const tx = await raffle.performUpkeep([])
                          const txReceipt = await tx.wait(1)
                          //   await winnerStartingBalannce = await accounts[1].getBalance()//
                          await vrfCoordinatorMock.fulfilRandomWords(
                              txReceipt.events[1].args.requestId,
                              raffle.address
                          )
                      })
                  }
              })
          })
      })
