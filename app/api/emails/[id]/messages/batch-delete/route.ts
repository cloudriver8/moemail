import { NextResponse } from "next/server"
import { createDb } from "@/lib/db"
import { messages, emails } from "@/lib/schema"
import { and, eq, inArray } from "drizzle-orm"
import { getUserId } from "@/lib/apiKey"
export const runtime = "edge"

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()

  try {
    const db = createDb()
    const { id } = await params
    const { messageIds } = await request.json<{ messageIds: string[] }>()

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
          { error: "messageIds must be a non-empty array" },
          { status: 400 }
      )
    }

    const email = await db.query.emails.findFirst({
      where: and(
          eq(emails.id, id),
          eq(emails.userId, userId!)
      )
    })

    if (!email) {
      return NextResponse.json(
          { error: "Email not found or no permission" },
          { status: 403 }
      )
    }

    // 只删除属于该邮箱的邮件，避免越权删除
    const deleted = await db.delete(messages)
        .where(
          and(
            eq(messages.emailId, id),
            inArray(messages.id, messageIds)
          )
        )
        .returning({ id: messages.id })

    return NextResponse.json({ success: true, deletedCount: deleted.length })
  } catch (error) {
    console.error('Failed to batch delete messages:', error)
    return NextResponse.json(
        { error: "Failed to batch delete messages" },
        { status: 500 }
    )
  }
}
