// ComplianceRegistry.sol — replaces Tempo TIP-403 precompile for Mezo

export const ComplianceRegistryABI = [
  {
    type: 'function',
    name: 'isAuthorized',
    inputs: [
      { name: 'policyId', type: 'uint64', internalType: 'uint64' },
      { name: 'wallet', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'createPolicy',
    inputs: [{ name: 'policyId', type: 'uint64', internalType: 'uint64' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setBlocked',
    inputs: [
      { name: 'policyId', type: 'uint64', internalType: 'uint64' },
      { name: 'wallet', type: 'address', internalType: 'address' },
      { name: 'blocked', type: 'bool', internalType: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'policyActive',
    inputs: [{ name: '', type: 'uint64', internalType: 'uint64' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
] as const
