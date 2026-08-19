export interface BlockRequirement {
  modules?: Record<string, string>;
  plugins?: Record<string, string>;
  capabilities?: string[];
}

export interface BlockPreset<TProps extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  version: string;
  category: string;
  label: string;
  thumbnail: string;
  requirements: BlockRequirement;
  defaultProps: TProps;
  compile: (props: TProps) => Record<string, unknown>;
}

