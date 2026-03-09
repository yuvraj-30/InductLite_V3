const taskMap = new Map<string, unknown>();

export function isTaskDefined(name: string): boolean {
  return taskMap.has(name);
}

export function defineTask(name: string, handler: unknown): void {
  taskMap.set(name, handler);
}
