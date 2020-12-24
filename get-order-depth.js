const program = require('commander');
const BigNumber = require("bignumber.js");
const { jtWallet } = require("jcc_wallet");
const config = require("./config");
const fetchDepth = require("./fetchDepth").fetchDepth;

program
  .usage('[options] <file ...>')
  .option('-A, --address <path>', "swtc钱包地址")
  .option('-b, --base <path>', "token名称")
  .option('-c, --counter <path>', "token名称")
  .option('-l, --limit <path>', "查询最大限制条数")
  .parse(process.argv);

const getDepth = async () => {
  const { address, base, counter, limit } = program;
  let options = {};
  try {
    // const nodes = await config.getRpcNodes();
    const nodes = config.rpcNodes;
    const rpcNode = nodes[Math.floor(Math.random() * nodes.length)];
    console.log("current rpcNode:", rpcNode);
    if (address) {
      if (jtWallet.isValidAddress(address.trim())) {
        options = {
          url: rpcNode,
          base: base,
          counter: counter,
          limit: new BigNumber(limit).toNumber(),
          wallet: address
        }
      } else {
        console.log("钱包地址不合法");
        process.exit();
      }
    } else {
      options = {
        url: rpcNode,
        base: base,
        counter: counter,
        limit: new BigNumber(limit).toNumber()
      };
    }
    const res = await fetchDepth(options);
    console.log(`${base.toUpperCase()}-${counter.toUpperCase()} 深度: `, res);
    // console.log(`${base.toUpperCase()}-${counter.toUpperCase()} 深度: `, JSON.stringify(res, '', 2));
  } catch (error) {
    console.log("通过节点获取深度失败:", error.message);
  }
}

getDepth();