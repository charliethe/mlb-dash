'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ResearchNote } from '@/types'
import { getResearchNotes, insertResearchNote, deleteResearchNote, getSupabase } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Trash2, FileText, Search, X, Database } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const NOTES_KEY = 'mlb-research-notes'

function loadLocalNotes(): ResearchNote[] {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]')
    return raw.map((n: Partial<ResearchNote>) => ({
      id: n.id || nextId(),
      title: n.title || '',
      content: n.content || '',
      tags: n.tags || [],
      teamIds: n.teamIds || [],
      playerIds: n.playerIds || [],
      sourceUrls: n.sourceUrls || [],
      createdAt: n.createdAt || new Date().toISOString(),
      date: n.date || n.createdAt || new Date().toISOString(),
    }))
  } catch { return [] }
}

function saveLocalNotes(notes: ResearchNote[]) {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)) } catch { /* ignore */ }
}

let noteIdCounter = Date.now()
function nextId(): string { return `local_${++noteIdCounter}` }

export function ResearchNotes({ prefillPlayerId, prefillPlayerName }: { prefillPlayerId?: number; prefillPlayerName?: string }) {
  const [notes, setNotes] = useState<ResearchNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(!!prefillPlayerId)
  const [title, setTitle] = useState(prefillPlayerName ? `Note on ${prefillPlayerName}` : '')
  const [content, setContent] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [saveError, setSaveError] = useState(false)
  const [dbAvailable, setDbAvailable] = useState<boolean | null>(null)

  useEffect(() => { loadNotes() }, [])

  async function loadNotes() {
    setLoading(true)
    const data = await getResearchNotes()
    if (data.length > 0) {
      setNotes(data)
      setDbAvailable(true)
    } else {
      const local = loadLocalNotes()
      setNotes(local)
      setDbAvailable(local.length > 0 || getSupabase() === null ? false : null)
    }
    setLoading(false)
  }

  async function handleCreate() {
    if (!title.trim()) return
    setSaveError(false)
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    const note: ResearchNote = {
      id: nextId(),
      title: title.trim(),
      content: content.trim(),
      tags,
      teamIds: prefillPlayerId ? [prefillPlayerId] : [],
      playerIds: prefillPlayerId ? [prefillPlayerId] : [],
      sourceUrls: [],
      createdAt: new Date().toISOString(),
      date: new Date().toISOString(),
    }
    const result = await insertResearchNote({
      title: note.title,
      content: note.content || undefined,
      tags: note.tags,
      playerIds: note.playerIds,
    })
    if (result) {
      note.id = result.id
    } else {
      const local = loadLocalNotes()
      local.unshift(note)
      saveLocalNotes(local)
    }
    setTitle('')
    setContent('')
    setTagsInput('')
    setShowForm(false)
    loadNotes()
  }

  async function handleDelete(id: string) {
    const deleted = await deleteResearchNote(id)
    if (!deleted) {
      const local = loadLocalNotes().filter((n) => n.id !== id)
      saveLocalNotes(local)
    }
    loadNotes()
  }

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    notes.forEach((n) => n.tags?.forEach((t) => tagSet.add(t)))
    return [...tagSet].sort()
  }, [notes])

  const filtered = useMemo(() => {
    let result = notes
    if (activeTag) {
      result = result.filter((n) => n.tags?.includes(activeTag))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((n) => n.title.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q))
    }
    return result
  }, [notes, activeTag, search])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-lg font-semibold tracking-tight mr-auto">Research Notes</h1>
        {dbAvailable === false && (
          <span className="text-[10px] text-amber-400 flex items-center gap-1">
            <Database className="h-3 w-3" /> Local only
          </span>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3 w-3" />
          New Note
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Note title" />
            <textarea placeholder="Notes…" value={content} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)} rows={4} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" aria-label="Note content" />
            <Input placeholder="Tags (comma-separated, e.g. trade, scouting)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} aria-label="Note tags" />
            {prefillPlayerName && (
              <p className="text-xs text-muted-foreground">Linked to: {prefillPlayerName}</p>
            )}
            {saveError && <p className="text-xs text-red-400">Failed to save note. Check database connection.</p>}
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={handleCreate} disabled={!title.trim()}>Save</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowForm(false); setTagsInput('') }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            aria-label="Search notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-7 text-xs"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  activeTag === tag ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {tag}
              </button>
            ))}
            {activeTag && (
              <button onClick={() => setActiveTag('')} className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer" aria-label="Clear tag filter">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {search || activeTag ? 'No notes match your search' : 'No research notes yet'}
            </p>
            {!search && !activeTag && (
              <Button variant="outline" size="sm" className="mt-3 h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
                <Plus className="h-3 w-3" />Create your first note
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((note) => (
            <Card key={note.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{note.title}</p>
                    {note.content && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{note.content}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{note.date ? format(parseISO(note.date), 'MMM d, yyyy') : ''}</span>
                      {note.tags?.map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(note.id)} className="shrink-0 h-6 w-6 flex items-center justify-center rounded hover:bg-muted/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" aria-label="Delete note">
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
