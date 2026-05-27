import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["admin", "agent", "karyawan"]);

export const statusEnum = pgEnum("status", [
  "open",
  "in_progress",
  "pending",
  "resolved",
  "closed",
]);

export const priorityEnum = pgEnum("priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

/**
 * Users table.
 * `id` is a UUID that maps directly to the Supabase `auth.users.id`
 * so we can link rows 1-to-1 with the auth provider.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: roleEnum("role").notNull().default("karyawan"),
  department: varchar("department", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Categories table.
 * Keeps a managed list of ticket categories (Hardware, Software, Network, etc.)
 */
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
});

/**
 * Tickets table.
 * Core entity representing a single helpdesk request.
 */
export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  status: statusEnum("status").notNull().default("open"),
  priority: priorityEnum("priority").notNull().default("medium"),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id),
  assignedToId: uuid("assigned_to_id").references(() => users.id),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Ticket comments table.
 * Stores the activity thread (human replies and system events) for each ticket.
 * Cascade-deletes when the parent ticket is removed.
 */
export const ticketComments = pgTable("ticket_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  message: text("message").notNull(),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  /** Tickets this user created */
  createdTickets: many(tickets, { relationName: "createdBy" }),
  /** Tickets assigned to this user (agent / admin) */
  assignedTickets: many(tickets, { relationName: "assignedTo" }),
  /** Comments authored by this user */
  comments: many(ticketComments),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  tickets: many(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  category: one(categories, {
    fields: [tickets.categoryId],
    references: [categories.id],
  }),
  createdBy: one(users, {
    fields: [tickets.createdById],
    references: [users.id],
    relationName: "createdBy",
  }),
  assignedTo: one(users, {
    fields: [tickets.assignedToId],
    references: [users.id],
    relationName: "assignedTo",
  }),
  comments: many(ticketComments),
}));

export const ticketCommentsRelations = relations(
  ticketComments,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketComments.ticketId],
      references: [tickets.id],
    }),
    user: one(users, {
      fields: [ticketComments.userId],
      references: [users.id],
    }),
  })
);
