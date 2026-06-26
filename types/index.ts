// Shared database entity shapes used across components and routes

export type ConversationMessage = {
  body: string
  direction: string
  created_at: string
  is_read: boolean
}

export type ConversationTenant = {
  id: string
  phone: string
  name: string | null
}

export type Conversation = {
  id: string
  status: string
  created_at: string
  last_message_at: string | null
  tenants: ConversationTenant | null
  messages: ConversationMessage[]
}

// Property management types

export type PropertyTenant = {
  id: string
  name: string | null
  phone: string
}

export type PropertyUnit = {
  id: string
  unit_number: string
  tenants: PropertyTenant[]
}

export type Property = {
  id: string
  name: string
  address: string
  created_at: string
  units: PropertyUnit[]
}

export type PropertySummary = {
  id: string
  name: string
}
