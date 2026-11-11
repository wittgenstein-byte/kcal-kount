/**
 * EventBus - Indirection / Observer pattern implementation
 * Provides loose coupling between Domain models/services and UI controllers/views.
 */
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  off(event, callback) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Publish an event to all subscribers
   * @param {string} event - Event name
   * @param {*} data - Payload
   */
  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventBus] Error in listener for event "${event}":`, error);
        }
      });
    }
  }
}

// Application-wide EventBus instance
export const eventBus = new EventBus();

// Standard Event Constants
export const APP_EVENTS = {
  STATE_LOADED: 'state:loaded',
  MEALS_CHANGED: 'meals:changed',
  FAVORITES_CHANGED: 'favorites:changed',
  GOAL_CHANGED: 'goal:changed',
  DATE_CHANGED: 'date:changed',
  THEME_CHANGED: 'theme:changed',
  VIEW_CHANGED: 'view:changed',
  TOAST_TRIGGERED: 'ui:toast'
};
