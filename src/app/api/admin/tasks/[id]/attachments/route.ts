import { NextRequest, NextResponse } from 'next/server';
import { addAttachment, removeAttachment } from '@/lib/domain/taskService';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/admin/tasks/:id/attachments — Fayl yuklash */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'File is required' }, { status: 400 });
        }

        // Save file to public/uploads/tasks/
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'tasks');
        await mkdir(uploadDir, { recursive: true });

        const ext = path.extname(file.name);
        const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        const filePath = path.join(uploadDir, safeName);

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);

        const fileUrl = `/uploads/tasks/${safeName}`;

        const attachment = await addAttachment(parseInt(id, 10), {
            fileName: file.name,
            fileUrl,
            fileSize: file.size,
            mimeType: file.type || undefined,
        });

        return NextResponse.json(attachment, { status: 201 });
    } catch (err) {
        console.error('[API Attachments POST]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

/** DELETE /api/admin/tasks/:id/attachments — Fayl o'chirish */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const attachmentId = searchParams.get('attachmentId');

        if (!attachmentId) {
            return NextResponse.json({ error: 'attachmentId is required' }, { status: 400 });
        }

        const attachment = await removeAttachment(parseInt(attachmentId, 10));

        // Try to delete the physical file
        try {
            const filePath = path.join(process.cwd(), 'public', attachment.fileUrl);
            await unlink(filePath);
        } catch { /* file may not exist */ }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[API Attachments DELETE]', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
