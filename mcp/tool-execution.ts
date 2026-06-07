export interface ToolExecution {
  taskSupport: "forbidden";
}

export function toolExecution(): ToolExecution {
  return { taskSupport: "forbidden" };
}
