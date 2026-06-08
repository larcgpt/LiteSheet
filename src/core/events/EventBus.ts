export type EventHandler = (...args: any[]) => void

export class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map()

  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler)
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(...args)
      } catch (e) {
        console.error(`Error in event handler for ${event}:`, e)
      }
    })
  }

  once(event: string, handler: EventHandler): () => void {
    const wrapper: EventHandler = (...args) => {
      this.off(event, wrapper)
      handler(...args)
    }
    return this.on(event, wrapper)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const Events = {
  CELL_CHANGE: 'cell:change',
  CELL_CLICK: 'cell:click',
  CELL_DBLCLICK: 'cell:dblclick',
  SELECTION_CHANGE: 'selection:change',
  SHEET_CHANGE: 'sheet:change',
  WORKBOOK_LOAD: 'workbook:load',
  RENDER_COMPLETE: 'render:complete',
  FORMULA_CALCULATE: 'formula:calculate',
  UNDO: 'undo',
  REDO: 'redo',
} as const
