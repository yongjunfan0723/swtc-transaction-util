const sign = require("jcc_exchange").sign;
const BigNumber = require("bignumber.js");
const program = require('commander');
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const readlineSync = require("readline-sync");
const JCCExchange = require("jcc_exchange").JCCExchange;
// const { NodeRpcFactory } = require("jcc_rpc");
const { ExplorerFactory } = require("jcc_rpc");
const JingchangWallet = require("jcc_wallet").JingchangWallet;
const jtWallet = require("jcc_wallet").jtWallet;
const Tx = require("jcc_exchange").Tx;
const isValidCurrency = require("@swtc/common").isValidCurrency;
const config = require("./config");

program
  .usage('[options] <file ...>')
  .option('-A, --address <path>', "钱包地址")
  .option('-P, --password <path>', "keystore密码")
  .option('-t, --type <path>', "文件类型")
  // .option('-c, --currency <path>', "token名称")
  // .option('-a, --amount <path>', "数量")
  // .option('-t, --to <path>', "转入钱包地址")
  // .option('-m, --memo <path>', "备注")
  .parse(process.argv);


// const delay = async (timer) => {
//   return new Promise((resolve) => setTimeout(resolve, timer));
// };

const isObject = (obj) => {
  return Object.prototype.toString.call(obj) === "[object Object]";
};

const parseCsv = () => {
  return new Promise((resolve, reject) => {
    try {
      const  filePath = path.join(__dirname, './batch_test/test.csv');
      // Read CSV
      let readFile = fs.readFileSync(filePath, { encoding: 'utf-8' }, (err) => {
        console.log("read csv file error:", err.message);
        reject(error);
      });
      
      // Split on row
      readFile = readFile.split("\n");
      
      // Get first row for column headers
      const headers = readFile.shift().split(",");
      
      const json = [];    
      readFile.forEach((item) =>{
          // Loop through each row
          let tmp = {}
          let row = item.split(",")
          for(let i = 0; i < headers.length; i++) {
              tmp[headers[i]] = row[i];
          }
          // Add object to list
          json.push(tmp);
      });
      resolve(json);
    } catch(err) {
      console.log("解析csv文件过程中发生的错误:", err);
      reject(error);
    }
});
}

const transfer = async () => {
  const { address, type } = program;
  let password = program.password;
  try {
    if(!jtWallet.isValidAddress(address.trim())) {
      console.log(`${address} 不合法`);
      return;
    }
    if (!password) {
      password = readlineSync.question("Please Enter Password:", { hideEchoBack: true });
    }
    const explorerInst = ExplorerFactory.init(config.explorerNodes);
    const list = [];
    const tokens = [];
    let parseData;
    if(type === "0") {
      const isexistExcel = fs.existsSync("./batch_test/testTransfer.xlsx");
      if(!isexistExcel) {
        console.log("请导入xlsx文件!");
        return;
      }
      const file = fs.readFileSync("./batch_test/testTransfer.xlsx", { encoding: "binary" });
      const workBook = XLSX.read(file, { type: "binary" });
      const worksheet = workBook.Sheets[workBook.SheetNames[0]];
      parseData = XLSX.utils.sheet_to_json(worksheet);
    } else {
      const isexistCsv = fs.existsSync("./batch_test/test.csv");
       if(!isexistCsv) {
         console.log("请导入csv文件!");
         return;
       }
       parseData = await parseCsv();
    }
    for(let item of parseData) {
        let txData = {
          to: item["地址"]? item["地址"].trim() : "",
          token: item["币种"]? item["币种"].trim().toUpperCase() : "",
          amount: item["数量"] || "",
          memo: item["转账备注"] || "",
          // status: 0,
        };
        if (jtWallet.isValidAddress(txData.to) && !new BigNumber(txData.amount).isNaN() && new BigNumber(txData.amount).gt(0) && isValidCurrency(txData.token)) {
          if(txData.to === address) {
            console.log(`转入地址: ${txData.to} 和 转出地址: ${address} 是同一地址`);
            continue;
          }
          const toBalance = await explorerInst.getBalances(txData.to, txData.to);
           if(toBalance.code === "2004") {
             console.log(`${txData.to} 未激活`);
             continue;
           }
           if(toBalance.result) {
            txData.amount = new BigNumber(txData.amount).toString(10);
            list.push(txData);
            tokens.push(txData.token);
           }
      }
    }
  if(list.length === 0) {
      return;
  }
  console.log("解析出来的合法数据:", list);
  const balanceRes = await explorerInst.getBalances(address, address);
  if (!balanceRes.result) {
    console.log("获取转出地址资产失败:", balanceRes.msg);
    if(balanceRes.code === "2004") {
      console.log(`转出地址${address} 未激活`);
    }
    return;
  }
  const data = balanceRes.data;
  const balance = {};
  for (const token of tokens) {
    let key;
    if (token.toUpperCase() === "SWT") {
      key = "SWTC";
    } else {
      key = `${token.toUpperCase()}_jGa9J9TkqtBcUoHe2zqhVFFbgUVED6o9or`;
    }
    const b = data[key];
    let available = new BigNumber(0);
    if (b) {
      available = new BigNumber(b.value).minus(b.frozen);
    }
    balance[token] = {
      available
    };
  }
    const transferList = [];
    const nodes = config.rpcNodes;
    JCCExchange.init(nodes, 0);
    let sequence = await JCCExchange.getSequence(address);
    for(let i = 0; i < list.length; i++) {
      if(new BigNumber(list[i].amount).gt(balance[list[i].token].available)){
        console.log(`${list[i].token} 的资产${balance[list[i].token].available.toString(10)} 小于实际要转的数量${new BigNumber(list[i].amount).toString(10)}`);
        continue;
      }
      const tx = Tx.serializePayment( 
        address,
        list[i].amount,
        list[i].to,
        list[i].token,
        isObject(list[i].memo) ? JSON.stringify(list[i].memo) : list[i].memo);
        const copyTx = Object.assign({}, tx);
        if(i === 0) {
          copyTx.Sequence = sequence;
        } else {
          sequence = sequence + 1;
          copyTx.Sequence = sequence;
        }
        transferList.push(copyTx);
    }
    console.log("组装成的TX数组:", transferList);
    console.log("要发送多少笔TX:", transferList.length);
    if(transferList.length === 0){
      return;
    }
    const gasFee = new BigNumber(transferList.length).times(0.00001);
    if(new BigNumber(balance["SWT"].available).lt(gasFee)) {
      console.log("gas费不足");
      return;
    }
    const keystore = fs.readFileSync("./keystore/wallet.json", { encoding: "utf-8" });
    const instance = new JingchangWallet(JSON.parse(keystore), true, false);
    const secret = await instance.getSecretWithAddress(password, address);
    const signList = [];
    for(let tx of transferList) {
      try {
        const signData = sign(tx, secret, "jingtum", true);
        signList.push(signData);
      } catch(err) {
        console.log("签名失败:", err.message);
      }
    }
    const hashList = [];
    const failSendList = [];
    for(let item of signList) {
      let retry = 0;
      let hash;
      while(!hash) {
        if (retry === 3) {
          failSendList.push(item);
          break;
        }
        try {
          hash = await JCCExchange.sendRawTransaction(item.blob);
          hashList.push(hash);
        } catch (error) {
          let errorAmount, errorCurrency;
          const Amount = item.tx.Amount;
          if(typeof Amount === "string") {
              errorAmount = Amount;
              errorCurrency = "SWT";
          } else {
              errorAmount = Amount.value;
              errorCurrency = Amount.currency;
          }
          if(error.message !== "Missing/inapplicable prior transaction." && error.message !== "This sequence number has already past.") {
            console.log("不是因为Sequence导致的失败");
            console.log(`这条to: ${item.tx.Destination}, token: ${errorCurrency} , amount: ${errorAmount}, sequence: ${item.tx.Sequence}  失败: ${error.message}`);
            failSendList.push(item);
            break;
          }
          console.log(`这条to: ${item.tx.Destination}, token: ${errorCurrency} , amount: ${errorAmount}, sequence: ${item.tx.Sequence}  失败: ${error.message}`);
          retry = retry + 1;
        }
      }
    }
    console.log("转账失败的数组:", failSendList, "失败多少条:", failSendList.length);
    if(failSendList.length > 0) {
      const filterArr = failSendList.map(item => {
        return {
          地址: item.tx.Destination,
          币种: typeof item.tx.Amount === "string" ? "SWT" : item.tx.Amount.currency,
          数量: typeof item.tx.Amount === "string" ?  item.tx.Amount : item.tx.Amount.value,
          转账备注: item.tx.Memos[0].Memo.MemoData ? item.tx.Memos[0].Memo.MemoData : ""
        }
        });
        const sheet = XLSX.utils.json_to_sheet(filterArr);
        const newWorkBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWorkBook, sheet, "sheet1");
        XLSX.writeFile(newWorkBook, "testTransfer.xlsx");
    }
    console.log("转账hash数组:", hashList);
    if(hashList.length === 0) {
      console.log("转账全部失败,请重新转账!");
      return;
    }
    if(transferList.length === hashList.length) {
      console.log("转账全部完成");
    }
    for(let hash of hashList) {
      while(true) {
        const res = await explorerInst.orderDetail(Date.now(), hash);
        if(res.result && res.data.succ === "tesSUCCESS") {
          break;
        }
       }
     }
   console.log("校验转账成功!");
  } catch (error) {
    console.log("error:", error.message);
  }
}

transfer();