import BigNumber from 'bignumber.js';

import { USD } from 'maker';
import { toHex } from 'utils/ethereum';
import { fromWei, fromRad, fromRay, sub, mul, RAY } from 'utils/units';
import {
  ADAPTER_BALANCE,
  MAX_AUCTION_LOT_SIZE,
  LIQUIDATION_PENALTY,
  LIQUIDATOR_ADDRESS,
  LIQUIDATION_RATIO,
  FEED_SET_USD,
  FEED_VALUE_USD,
  RATE,
  ILK_RATE,
  LAST_DRIP,
  PRICE_WITH_SAFETY_MARGIN,
  DEBT_CEILING
} from 'reducers/feeds';

export const priceFeed = addresses => (name, { decimals = 18 } = {}) => ({
  target: addresses[`PIP_${name}`],
  call: ['peek()(uint256,bool)'],
  returns: [
    [`${name}.${FEED_VALUE_USD}`, val => USD(val, -decimals)],
    [`${name}.${FEED_SET_USD}`, liveness => (liveness ? 'live' : 'ded')]
  ]
});

export const rateData = addresses => name => ({
  target: addresses.MCD_JUG,
  call: ['ilks(bytes32)(uint256,uint48)', toHex(name)],
  returns: [
    [
      `${name}.${RATE}`,
      val => {
        const taxBigNumber = new BigNumber(val.toString()).dividedBy(RAY);
        const secondsPerYear = 60 * 60 * 24 * 365;
        BigNumber.config({ POW_PRECISION: 100 });
        return taxBigNumber
          .pow(secondsPerYear)
          .minus(1)
          .toFixed(3);
      }
    ],
    [`${name}.${LAST_DRIP}`]
  ]
});

export const ilkVatData = addresses => name => ({
  target: addresses.MCD_VAT,
  call: ['ilks(bytes32)(uint256,uint256,uint256,uint256,uint256)', toHex(name)],
  returns: [[], [`${name}.${ILK_RATE}`, val => fromRay(val, 5)], [], [], []]
});

export const pitData = addresses => name => ({
  target: addresses.MCD_PIT,
  call: ['ilks(bytes32)(uint256,uint256)', toHex(name)],
  returns: [
    [`${name}.${PRICE_WITH_SAFETY_MARGIN}`, val => fromRay(val, 5)],
    [
      `${name}.${DEBT_CEILING}`,
      val =>
        console.log(`***PIT debtCeiling for ${name}`, val) || fromWei(val, 5)
    ]
  ]
});

export const liquidation = addresses => name => ({
  target: addresses[`MCD_SPOT`],
  call: ['ilks(bytes32)(address,uint256)', toHex(name)],
  returns: [
    [`pip${name}`],
    [`${name}.${LIQUIDATION_RATIO}`, val => fromRay(mul(val, 100), 0)]
  ]
});

export const flipper = addresses => name => ({
  target: addresses.MCD_CAT,
  call: ['ilks(bytes32)(address,uint256,uint256)', toHex(name)],
  returns: [
    [`${name}.${LIQUIDATOR_ADDRESS}`],
    [
      `${name}.${LIQUIDATION_PENALTY}`,
      val => fromRay(mul(sub(val, RAY), 100), 2)
    ],
    [`${name}.${MAX_AUCTION_LOT_SIZE}`, val => fromWei(val, 5)]
  ]
});

export const adapterBalance = addresses => name => ({
  target: addresses[name],
  call: ['balanceOf(address)(uint256)', addresses[`MCD_JOIN_${name}`]],
  returns: [[`${name}.${ADAPTER_BALANCE}`, val => fromWei(val, 5)]]
});

export const lineData = addresses => name =>
  console.log('line data', addresses, name) || {
    target: addresses.MCD_VAT,
    call: [
      'ilks(bytes32)(uint256,uint256,uint256,uint256,uint256)',
      toHex(name)
    ],
    returns: [
      [],
      [],
      [],
      [
        `${name}.${DEBT_CEILING}`,
        val =>
          console.log(`debtCeiling for ${name}`, val, fromRad(val, 5)) ||
          fromRad(val, 5)
      ],
      []
    ]
  };

export function createCDPTypeModel(ilk, addresses) {
  const cdpModel = [
    priceFeed,
    rateData,
    pitData,
    liquidation,
    flipper,
    ilkVatData,
    adapterBalance,
    lineData
  ].map(f => f(addresses)(ilk));
  return cdpModel;
}
