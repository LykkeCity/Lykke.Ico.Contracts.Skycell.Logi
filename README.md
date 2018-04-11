# Lykke.Ico.Contracts.Skycell.Logi

Smart Containers Logi token is based on [MiniMe](https://github.com/Giveth/minime) token.
This allows us to have fully-functional ERC-20 token with just a couple lines of code and without restrictions for any further functionality.
All additional facilities, like voting, will be implemented through MiniMe cloning abilities.

## Development Process

We use [Truffle](http://truffleframework.com/docs/) for development and testing.

Install Truffle:

```npm install -g truffle```

Install testing dependencies:

```npm install --save-dev chai chai-bignumber```

Launch develop network:

```truffle develop```

Or you can use pre-configured *dev* network to connect to any Etherium client on *localhost:7545*: 

```truffle console --network dev```

Publish contract:

```migrate --reset```.

Test:

```test```

Or you can run tests on develop network without pre-launching:

```truffle test```

See [documentation](http://truffleframework.com/docs/) for further scenarios.