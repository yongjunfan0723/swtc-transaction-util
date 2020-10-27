const axios = require("axios");

const getRpcNodes = async () => {
  const res = await axios.get("https://gateway.swtc.top/rpcservice", { timeout: 30000 });
  if (res.status === 200 && res.data.count > 0) {
    return res.data.rpcpeers;
  } else {
    return [
      "https://srje115qd43qw2.swtc.top",
      "https://srje071qdew231.swtc.top"
    ]
  }
}

exports.getRpcNodes = getRpcNodes;
// module.exports = { getRpcNodes };

// const rpcNodes = [
//   "https://srje115qd43qw2.swtc.top",
//   "https://srje071qdew231.swtc.top"
// ];

// exports.rpcNodes = rpcNodes;
