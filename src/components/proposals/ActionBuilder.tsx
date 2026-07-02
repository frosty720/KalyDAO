import React, { useState, useEffect } from 'react';
import { encodeFunctionData, parseEther } from 'viem';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { CONTRACT_ADDRESSES_BY_NETWORK } from '@/blockchain/contracts/addresses';
import { useChainId, useReadContract } from 'wagmi';
import { toTokenAmount, toTokenAmountList } from '@/lib/tokenAmount';

// Minimal ERC20 ABI to read a token's decimals (audit H3 — never assume 18).
const erc20DecimalsAbi = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;
import { Info, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Update action types to match all categories
type ActionType = 'custom' | 'transfer' | 'transfer-erc20' | 'transfer-erc20-batch' | 'governance' | 'protocol' | 'community' | 'technical';
type ParameterType = 'string' | 'number' | 'boolean';

// ABI for native token transfers
const treasuryVaultAbi = [
  {
    inputs: [
      { internalType: 'address payable', name: 'recipient', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'sendNativeToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'address', name: 'recipient', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'sendERC20Token',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'address[]', name: 'recipients', type: 'address[]' },
      { internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' },
    ],
    name: 'batchSendERC20Token',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ABI for DAO Settings contract
const daoSettingsAbi = [
  {
    inputs: [
      { internalType: 'string', name: 'category', type: 'string' },
      { internalType: 'string', name: 'key', type: 'string' },
      { internalType: 'string', name: 'value', type: 'string' },
    ],
    name: 'setStringParameter',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'category', type: 'string' },
      { internalType: 'string', name: 'key', type: 'string' },
      { internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'setNumericParameter',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'category', type: 'string' },
      { internalType: 'string', name: 'key', type: 'string' },
      { internalType: 'bool', name: 'value', type: 'bool' },
    ],
    name: 'setBoolParameter',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Governance settings ABI (for governance category)
const governorSettingsAbi = [
  {
    inputs: [{ internalType: 'uint256', name: 'newVotingDelay', type: 'uint256' }],
    name: 'setVotingDelay',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'newVotingPeriod', type: 'uint256' }],
    name: 'setVotingPeriod',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'newProposalThreshold', type: 'uint256' }],
    name: 'setProposalThreshold',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Common parameter templates for each category
type ParameterTemplate = {
  key: string;
  label: string;
  description: string;
  type: ParameterType;
  defaultValue?: string;
};

// Protocol parameter templates (system settings)
const protocolTemplates: ParameterTemplate[] = [
  {
    key: "min_proposal_threshold",
    label: "Minimum Proposal Threshold",
    description: "Minimum amount of gKLC required to create a proposal",
    type: "number",
    defaultValue: "100000"
  },
  {
    key: "feature_toggle_staking",
    label: "Staking Feature Toggle",
    description: "Enable or disable the staking feature",
    type: "boolean",
    defaultValue: "true"
  },
  {
    key: "max_proposal_actions",
    label: "Maximum Proposal Actions",
    description: "Maximum number of actions allowed in a single proposal",
    type: "number",
    defaultValue: "10"
  },
  {
    key: "protocol_version",
    label: "Protocol Version",
    description: "Current version of the protocol",
    type: "string",
    defaultValue: "1.0.0"
  }
];

// Community parameter templates (social settings)
const communityTemplates: ParameterTemplate[] = [
  {
    key: "discord_invite",
    label: "Discord Invite Link",
    description: "Official Discord invite URL",
    type: "string",
    defaultValue: "https://discord.gg/your-community"
  },
  {
    key: "telegram_link",
    label: "Telegram Group Link",
    description: "Official Telegram group URL",
    type: "string",
    defaultValue: "https://t.me/your-community"
  },
  {
    key: "community_guidelines",
    label: "Community Guidelines",
    description: "Link to community guidelines document",
    type: "string",
    defaultValue: "https://docs.yourprotocol.com/guidelines"
  },
  {
    key: "featured_project",
    label: "Featured Community Project",
    description: "Currently featured community-driven project",
    type: "string"
  }
];

// Technical parameter templates (technical settings)
const technicalTemplates: ParameterTemplate[] = [
  {
    key: "gas_limit",
    label: "Gas Limit",
    description: "Maximum gas limit for transaction execution",
    type: "number",
    defaultValue: "8000000"
  },
  {
    key: "maintenance_mode",
    label: "Maintenance Mode",
    description: "Enable or disable maintenance mode",
    type: "boolean",
    defaultValue: "false"
  },
  {
    key: "rpc_endpoint",
    label: "RPC Endpoint",
    description: "Default RPC endpoint URL",
    type: "string",
    defaultValue: "https://rpc.kalychain.io"
  },
  {
    key: "contract_upgrade_timelock",
    label: "Contract Upgrade Timelock (hours)",
    description: "Timelock delay in hours for contract upgrades",
    type: "number",
    defaultValue: "48"
  }
];

interface ActionBuilderProps {
  field: {
    onChange: (value: `0x${string}`) => void;
    value: `0x${string}` | string;
    name: string;
  };
  actionIndex: number;
  updateActionFields: (index: number, updates: { target?: string; value?: string }) => void;
}

export const ActionBuilder: React.FC<ActionBuilderProps> = ({ field, actionIndex, updateActionFields }) => {
  const [actionType, setActionType] = useState<ActionType>('custom');
  const [parameterKey, setParameterKey] = useState<string>('');
  const [parameterValue, setParameterValue] = useState<string>('');
  const [parameterType, setParameterType] = useState<ParameterType>('string');
  
  // For transfer actions
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  
  // For ERC20 transfer actions
  const [tokenAddress, setTokenAddress] = useState<string>('');
  
  // For batch ERC20 transfer
  const [recipients, setRecipients] = useState<string>(''); // Comma-separated addresses
  const [amounts, setAmounts] = useState<string>(''); // Comma-separated amounts
  
  // For governance actions
  const [governanceFunction, setGovernanceFunction] = useState<string>('');
  
  const chainId = useChainId();

  // Get contract addresses
  const addresses = chainId === 3889
    ? CONTRACT_ADDRESSES_BY_NETWORK.testnet
    : CONTRACT_ADDRESSES_BY_NETWORK.mainnet;

  // Read the ERC20 token's real decimals so transfer amounts are scaled correctly
  // (audit H3). Enabled only for token-transfer actions with a valid token address.
  const isErc20Action = actionType === 'transfer-erc20' || actionType === 'transfer-erc20-batch';
  const isTokenAddress = /^0x[a-fA-F0-9]{40}$/.test(tokenAddress);
  const {
    data: tokenDecimalsRaw,
    isLoading: isLoadingDecimals,
    isError: isDecimalsError,
  } = useReadContract({
    address: isTokenAddress ? (tokenAddress as `0x${string}`) : undefined,
    abi: erc20DecimalsAbi,
    functionName: 'decimals',
    chainId,
    query: { enabled: isErc20Action && isTokenAddress },
  });
  const tokenDecimals = tokenDecimalsRaw === undefined ? undefined : Number(tokenDecimalsRaw);

  // Add a new state variable for template vs custom mode
  const [useTemplate, setUseTemplate] = useState<boolean>(true);
  
  // Add a helper function to get templates based on action type
  const getTemplatesForCategory = (): ParameterTemplate[] => {
    if (actionType === 'protocol') return protocolTemplates;
    if (actionType === 'community') return communityTemplates;
    if (actionType === 'technical') return technicalTemplates;
    return [];
  };
  
  // Add a function to handle template selection
  const handleTemplateSelect = (template: ParameterTemplate) => {
    setParameterKey(template.key);
    setParameterValue(template.defaultValue || '');
    setParameterType(template.type);
  };

  // Effect to generate calldata based on action type
  useEffect(() => {
    try {
      switch (actionType) {
        case 'transfer':
          if (recipient && amount && /^0x[a-fA-F0-9]{40}$/.test(recipient)) {
            const calldata = encodeFunctionData({
              abi: treasuryVaultAbi,
              functionName: 'sendNativeToken',
              args: [recipient as `0x${string}`, parseEther(amount)],
            });
            field.onChange(calldata);
            updateActionFields(actionIndex, {
              target: addresses.TREASURY_VAULT,
              value: '0',
            });
          }
          break;
          
        case 'transfer-erc20':
          if (tokenAddress && recipient && amount &&
              /^0x[a-fA-F0-9]{40}$/.test(tokenAddress) &&
              /^0x[a-fA-F0-9]{40}$/.test(recipient)) {
            // Scale by the token's REAL decimals, never a hardcoded 18 (audit H3). Wait
            // for the on-chain decimals read before encoding so we never emit a wrong
            // amount; clear stale calldata to block submission until it resolves.
            if (tokenDecimals === undefined) {
              field.onChange('0x');
              break;
            }
            const calldata = encodeFunctionData({
              abi: treasuryVaultAbi,
              functionName: 'sendERC20Token',
              args: [
                tokenAddress as `0x${string}`,
                recipient as `0x${string}`,
                toTokenAmount(amount, tokenDecimals)
              ],
            });
            field.onChange(calldata);
            updateActionFields(actionIndex, {
              target: addresses.TREASURY_VAULT,
              value: '0',
            });
          }
          break;
          
        case 'transfer-erc20-batch':
          if (tokenAddress && recipients && amounts &&
              /^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
            // Same as single transfer: scale by the token's real decimals (audit H3),
            // and wait for the decimals read before encoding.
            if (tokenDecimals === undefined) {
              field.onChange('0x');
              break;
            }
            // Parse comma-separated lists into arrays
            const recipientList = recipients.split(',').map(addr => addr.trim()) as `0x${string}`[];
            const amountList = toTokenAmountList(amounts, tokenDecimals);

            // Validate all recipients are valid addresses
            const allRecipientsValid = recipientList.every(addr => /^0x[a-fA-F0-9]{40}$/.test(addr));

            if (allRecipientsValid && recipientList.length === amountList.length) {
              const calldata = encodeFunctionData({
                abi: treasuryVaultAbi,
                functionName: 'batchSendERC20Token',
                args: [
                  tokenAddress as `0x${string}`,
                  recipientList,
                  amountList
                ],
              });
              field.onChange(calldata);
              updateActionFields(actionIndex, {
                target: addresses.TREASURY_VAULT,
                value: '0',
              });
            }
          }
          break;

        case 'governance':
          if (governanceFunction && parameterValue) {
            const calldata = encodeFunctionData({
              abi: governorSettingsAbi,
              functionName: governanceFunction as any,
              args: [BigInt(parameterValue)],
            });
            field.onChange(calldata);
            updateActionFields(actionIndex, {
              target: addresses.GOVERNOR_CONTRACT,
              value: '0',
            });
          }
          break;

        case 'protocol':
        case 'community':
        case 'technical':
          if (parameterKey && parameterValue) {
            let functionName: "setStringParameter" | "setNumericParameter" | "setBoolParameter";
            let value: any;

            switch (parameterType) {
              case 'string':
                functionName = "setStringParameter";
                value = parameterValue;
                break;
              case 'number':
                functionName = "setNumericParameter";
                value = BigInt(parameterValue);
                break;
              case 'boolean':
                functionName = "setBoolParameter";
                value = parameterValue.toLowerCase() === 'true';
                break;
              default:
                throw new Error('Invalid parameter type');
            }

            const calldata = encodeFunctionData({
              abi: daoSettingsAbi,
              functionName,
              args: [actionType, parameterKey, value],
            });
            field.onChange(calldata);
            updateActionFields(actionIndex, {
              target: addresses.DAO_SETTINGS,
              value: '0',
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error generating calldata:', error);
      field.onChange('0x');
    }
  }, [
    actionType, tokenAddress, tokenDecimals, recipient, recipients, amounts, amount, parameterKey, parameterValue,
    parameterType, governanceFunction, field, actionIndex,
    updateActionFields, addresses
  ]);

  return (
    <div className="space-y-3">
      <Label htmlFor={`${field.name}-action-type`}>Action Type</Label>
      <Select onValueChange={(value) => setActionType(value as ActionType)} defaultValue={actionType}>
        <SelectTrigger id={`${field.name}-action-type`}>
          <SelectValue placeholder="Select action type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="custom">Custom Calldata</SelectItem>
          <SelectItem value="transfer">Transfer KLC (Native Token)</SelectItem>
          <SelectItem value="transfer-erc20">Transfer KRC20 Token</SelectItem>
          <SelectItem value="transfer-erc20-batch">Batch Transfer KRC20 Token</SelectItem>
          <SelectItem value="governance">Governance Settings</SelectItem>
          <SelectItem value="protocol">Protocol Parameter</SelectItem>
          <SelectItem value="community">Community Parameter</SelectItem>
          <SelectItem value="technical">Technical Parameter</SelectItem>
        </SelectContent>
      </Select>

      {actionType === 'transfer' && (
        <Card className="p-4 bg-muted/40">
          <CardContent className="space-y-3 pt-4">
            <div>
              <Label htmlFor={`${field.name}-recipient`}>Recipient Address</Label>
              <Input
                id={`${field.name}-recipient`}
                placeholder="0x... address to receive KLC"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`${field.name}-amount`}>Amount (in KLC)</Label>
              <Input
                id={`${field.name}-amount`}
                type="number"
                placeholder="e.g., 1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.000000000000000001"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {actionType === 'transfer-erc20' && (
        <Card className="p-4 bg-muted/40">
          <CardContent className="space-y-3 pt-4">
            <div>
              <Label htmlFor={`${field.name}-token-address`}>Token Contract Address</Label>
              <Input
                id={`${field.name}-token-address`}
                placeholder="0x... address of the KRC20 token contract"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the contract address of the KRC20 token to transfer
              </p>
            </div>
            <div>
              <Label htmlFor={`${field.name}-recipient-erc20`}>Recipient Address</Label>
              <Input
                id={`${field.name}-recipient-erc20`}
                placeholder="0x... address to receive tokens"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={`${field.name}-amount-erc20`}>Amount (in token units)</Label>
              <Input
                id={`${field.name}-amount-erc20`}
                type="number"
                placeholder="e.g., 1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.000000000000000001"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the amount in whole tokens (e.g., 1000 for 1000 tokens).
                {isTokenAddress && isLoadingDecimals && ' Reading token decimals…'}
                {isTokenAddress && isDecimalsError &&
                  ' ⚠ Could not read this token’s decimals — check the contract address.'}
                {tokenDecimals !== undefined && ` Token uses ${tokenDecimals} decimals.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {actionType === 'transfer-erc20-batch' && (
        <Card className="p-4 bg-muted/40">
          <CardContent className="space-y-3 pt-4">
            <div>
              <Label htmlFor={`${field.name}-token-address-batch`}>Token Contract Address</Label>
              <Input
                id={`${field.name}-token-address-batch`}
                placeholder="0x... address of the KRC20 token contract"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the contract address of the KRC20 token to transfer
              </p>
            </div>
            <div>
              <Label htmlFor={`${field.name}-recipients-batch`}>Recipient Addresses</Label>
              <Input
                id={`${field.name}-recipients-batch`}
                placeholder="0x1234..., 0x5678..., 0x9abc..."
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter comma-separated list of recipient addresses
              </p>
            </div>
            <div>
              <Label htmlFor={`${field.name}-amounts-batch`}>Amounts (in token units)</Label>
              <Input
                id={`${field.name}-amounts-batch`}
                placeholder="100, 200, 300"
                value={amounts}
                onChange={(e) => setAmounts(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter comma-separated list of whole-token amounts (must match the number of recipients).
                {isTokenAddress && isLoadingDecimals && ' Reading token decimals…'}
                {isTokenAddress && isDecimalsError &&
                  ' ⚠ Could not read this token’s decimals — check the contract address.'}
                {tokenDecimals !== undefined && ` Token uses ${tokenDecimals} decimals.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {actionType === 'governance' && (
        <Card className="p-4 bg-muted/40">
          <CardContent className="space-y-3 pt-4">
            <div>
              <Label htmlFor={`${field.name}-governance-function`}>Governance Setting</Label>
              <Select onValueChange={setGovernanceFunction}>
                <SelectTrigger>
                  <SelectValue placeholder="Select setting to change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="setVotingDelay">Voting Delay</SelectItem>
                  <SelectItem value="setVotingPeriod">Voting Period</SelectItem>
                  <SelectItem value="setProposalThreshold">Proposal Threshold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${field.name}-governance-value`}>Value (in blocks)</Label>
              <Input
                id={`${field.name}-governance-value`}
                type="number"
                placeholder="Enter number of blocks"
                value={parameterValue}
                onChange={(e) => setParameterValue(e.target.value)}
                min="0"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {(actionType === 'protocol' || actionType === 'community' || actionType === 'technical') && (
        <Card className="p-4 bg-muted/40">
          <CardContent className="space-y-3 pt-4">
            <Tabs defaultValue="templates" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="templates" onClick={() => setUseTemplate(true)}>Common Parameters</TabsTrigger>
                <TabsTrigger value="custom" onClick={() => setUseTemplate(false)}>Custom Parameter</TabsTrigger>
              </TabsList>
              
              <TabsContent value="templates" className="mt-4">
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">
                    Select from common {actionType} parameters:
                  </p>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {getTemplatesForCategory().map((template) => (
                    <div 
                      key={template.key}
                      className={`p-2 border rounded-md cursor-pointer hover:bg-secondary transition-colors ${
                        parameterKey === template.key ? 'border-primary bg-primary/10' : 'border-border'
                      }`}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-medium">{template.label}</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{template.description}</p>
                              <p className="text-xs mt-1">Type: {template.type}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Key: {template.key}
                      </p>
                    </div>
                  ))}
                </div>
                
                {parameterKey && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <Label htmlFor={`${field.name}-parameter-value`}>Parameter Value</Label>
                      {parameterType === 'boolean' ? (
                        <Select 
                          onValueChange={setParameterValue}
                          value={parameterValue}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select true or false" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">True</SelectItem>
                            <SelectItem value="false">False</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`${field.name}-parameter-value`}
                          type={parameterType === 'number' ? 'number' : 'text'}
                          placeholder={`Enter ${parameterType} value`}
                          value={parameterValue}
                          onChange={(e) => setParameterValue(e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="custom" className="mt-4 space-y-3">
                <div>
                  <Label htmlFor={`${field.name}-parameter-type`}>Parameter Type</Label>
                  <Select 
                    onValueChange={(value) => setParameterType(value as ParameterType)}
                    value={parameterType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parameter type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="boolean">True/False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`${field.name}-parameter-key`}>Parameter Key</Label>
                  <Input
                    id={`${field.name}-parameter-key`}
                    placeholder="Enter parameter key"
                    value={parameterKey}
                    onChange={(e) => setParameterKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Should be a unique identifier for this parameter (e.g., "feature_toggle_staking")
                  </p>
                </div>
                <div>
                  <Label htmlFor={`${field.name}-parameter-value`}>Parameter Value</Label>
                  {parameterType === 'boolean' ? (
                    <Select 
                      onValueChange={setParameterValue}
                      value={parameterValue}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select true or false" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`${field.name}-parameter-value`}
                      type={parameterType === 'number' ? 'number' : 'text'}
                      placeholder={`Enter ${parameterType} value`}
                      value={parameterValue}
                      onChange={(e) => setParameterValue(e.target.value)}
                    />
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {actionType === 'custom' && (
        <div>
          <Label htmlFor={field.name}>Calldata</Label>
          <Textarea
            id={field.name}
            placeholder="0x... encoded function call data"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value as `0x${string}`)}
            rows={3}
            className="font-mono text-xs"
          />
        </div>
      )}

      {field.value && field.value !== '0x' && (
        <div className="mt-2">
          <p className="text-xs font-medium text-muted-foreground">Generated Calldata:</p>
          <pre className="text-xs bg-secondary p-2 rounded overflow-x-auto">{field.value}</pre>
        </div>
      )}
    </div>
  );
};

export default ActionBuilder; 