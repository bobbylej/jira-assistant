export interface Action {
  actionType: string;
  parameters: any;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface ToolCallHandler {
  functionName: string;
  handler: (args: any) => Action;
}

export interface ActionHandler {
  actionType: string;
  handler: (action: Action, services: any) => Promise<ActionResult>;
} 