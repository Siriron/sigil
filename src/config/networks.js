export const NETWORKS = {
  bradbury: {
    id: 'bradbury',
    label: 'Bradbury',
    chainId: '0x107D',
    chainIdInt: 4221,
    rpcUrl: 'https://rpc.bradbury.genlayer.com',
    explorerUrl: 'https://explorer-bradbury.genlayer.com',
    chainName: 'GenLayer Bradbury',
    contracts: {
      registry:  '0x04454AEB3B6e8B46e999a6Fb9EBA17242f43Cb8D',
      auditlog:  '0xA9a45927B1912a5329241157CF51E91468024bED',
      milestone: '0xBd2735655fCE9059Cb0FfBB0B0C4d456384EB157',
    },
    milestoneCode: '/contracts/milestone.py',
  },
  studionet: {
    id: 'studionet',
    label: 'StudioNet',
    chainId: '0xF22F',
    chainIdInt: 61999,
    rpcUrl: 'https://studio.genlayer.com/api',
    explorerUrl: 'https://explorer-studio.genlayer.com',
    chainName: 'GenLayer StudioNet',
    contracts: {
      registry:  '0x47FB5751b83510F517494709e776eb81386cc9C2',
      auditlog:  '0xC16f4f3e0f713e6Be0B20E6fB5Ba1ba4006B34e2',
      milestone: '0x46cD4DB021B115Bd67183c035DC8b33E4c6E6775',
    },
    milestoneCode: '/contracts/milestone.py',
  },
}

export const DEFAULT_NETWORK = 'bradbury'
