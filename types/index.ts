// Shared database entity shapes used across components and routes

export type ConversationMessage = {
  body: string
  direction: string
  created_at: string
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
