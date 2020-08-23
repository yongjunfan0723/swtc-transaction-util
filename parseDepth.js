const { utils } = require("@swtc/utils");

const BigNumber = require("bignumber.js");

const parseAmount = utils.parseAmount;

const sortAsks = (a, b) => new BigNumber(a.price).minus(b.price).toNumber(); // 按价格从小到大排序

const sortBids = (a, b) => new BigNumber(b.price).minus(a.price).toNumber(); // 按价格从大到小排序

const parseOrderBook = (offers, isAsk = false) => {
  const orderbook = [];
  const len = offers.length;
  for (let i = 0; i < len; i++) {
    const { TakerGets, taker_gets_funded, TakerPays, taker_pays_funded, Platform } = offers[i];
    const takerGetsTotal = parseAmount(TakerGets);
    const takerGetsFunded = taker_gets_funded ? parseAmount(taker_gets_funded) : takerGetsTotal;
    const takerPaysTotal = parseAmount(TakerPays);
    const takerPaysFunded = taker_pays_funded ? parseAmount(taker_pays_funded) : takerPaysTotal;
    let price;
    let amount;
    let total;
    let type;
    if (isAsk) {
      price = new BigNumber(takerPaysTotal.value).div(takerGetsTotal.value).toString();
      amount = new BigNumber(takerGetsFunded.value).toString();
      total = new BigNumber(takerGetsTotal.value).toString();
      type = "sell";
    } else {
      price = new BigNumber(takerGetsTotal.value).div(takerPaysTotal.value).toString();
      amount = new BigNumber(takerPaysFunded.value).toString();
      total = new BigNumber(takerPaysTotal.value).toString();
      type = "buy";
    }
    orderbook.push({ price, amount, total, type, platform: Platform });
  }
  return orderbook;
};

const mergePrice = (offers) => {
  const res = {};
  const result = [];
  let totalValue = new BigNumber(0);
  const len = offers.length;
  for (let i = 0; i < len; ++i) {
    const offer = offers[i];
    const key = offer.price;
    if (res[key]) {
      res[key].amount = new BigNumber(res[key].amount).plus(offer.amount).toString();
    } else {
      res[key] = offer;
      result.push(res[key]);
    }
    totalValue = totalValue.plus(offer.amount);
    res[key].total = totalValue.toString();
  }
  return result;
};

const parseDepth = (bids, asks) => {
  const parsedBids = parseOrderBook(bids);
  const parsedAsks = parseOrderBook(asks, true);
  parsedAsks.sort(sortAsks);
  parsedBids.sort(sortBids);
  return {
    asks: mergePrice(parsedAsks),
    bids: mergePrice(parsedBids)
  };
};

module.exports = { parseDepth };