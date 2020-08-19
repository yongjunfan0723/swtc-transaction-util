const program = require('commander');
const BigNumber = require("bignumber.js");
const config = require("./config");
const fetchDepth = require("./fetchDepth").fetchDepth;

program
  .usage('[options] <file ...>')
  .option('-b, --base <path>', "token名称")
  .option('-c, --counter <path>', "token名称")
  .option('-l, --limit <path>', "查询最大限制条数")
  .parse(process.argv);

const getDepth = async () => {
  const { counter, base, limit } = program;
  try {
    const nodes = await config.getRpcNodes();
    const rpcNode = nodes[Math.floor(Math.random() * nodes.length)];
    console.log("current rpcNode:", rpcNode);
    const options = {
      url: rpcNode,
      base: base,
      counter: counter,
      limit: new BigNumber(limit).toNumber()
    };
    const res = await fetchDepth(options);
    console.log(`${base.toUpperCase()}-${counter.toUpperCase()} 深度: `, res);
    // console.log(`${base.toUpperCase()}-${counter.toUpperCase()} 深度: `, JSON.stringify(res, '', 2));
  } catch (error) {
    console.log("通过节点获取深度失败:", error.message);
  }
}

getDepth();