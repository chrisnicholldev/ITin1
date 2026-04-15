import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TipTapEditor } from '@/components/docs/TipTapEditor';
import { getFolders, getArticle, createArticle, updateArticle } from '@/api/docs';
import { getLocations } from '@/api/locations';
import { type DocFolderResponse, type ArticleResponse, type LocationResponse } from '@itdesk/shared';

export function ArticleEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!slug;

  const defaultFolderId = searchParams.get('folder') ?? '';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [folderId, setFolderId] = useState(defaultFolderId);
  const [locationId, setLocationId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [published, setPublished] = useState(true);
  const [sourceUrl, setSourceUrl] = useState('');
  const [initialised, setInitialised] = useState(false);

  const { data: folders = [] } = useQuery<DocFolderResponse[]>({
    queryKey: ['docs', 'folders'],
    queryFn: getFolders,
  });

  const { data: locations = [] } = useQuery<LocationResponse[]>({
    queryKey: ['locations'],
    queryFn: getLocations,
  });

  const { data: article } = useQuery<ArticleResponse>({
    queryKey: ['docs', 'articles', slug],
    queryFn: () => getArticle(slug!),
    enabled: isEditing,
  });

  // Populate form when editing
  useEffect(() => {
    if (article && !initialised) {
      setTitle(article.title);
      setBody(article.body);
      setFolderId(article.folder?.id ?? '');
      setLocationId((article.linkedLocation as any)?.id ?? '');
      setTags(article.tags ?? []);
      setPublished(article.published);
      setSourceUrl((article as any).sourceUrl ?? '');
      setInitialised(true);
    }
  }, [article, initialised]);

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const payload = {
        title,
        body,
        folderId: folderId || undefined,
        linkedLocationId: locationId || undefined,
        linkedAssets: [],
        tags,
        published,
        sourceUrl: sourceUrl.trim() || undefined,
      };
      return isEditing ? updateArticle(slug!, payload) : createArticle(payload);
    },
    onSuccess: (data: ArticleResponse) => {
      queryClient.invalidateQueries({ queryKey: ['docs', 'articles'] });
      navigate(`/docs/articles/${data.slug}`);
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Failed to save article'),
  });

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPublished(!published)}
          >
            {published ? 'Published' : 'Draft'}
          </Button>
          <Button onClick={() => mutate()} disabled={!title.trim() || !body || isPending}>
            {isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving…</> : isEditing ? 'Save' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* Title */}
      <div>
        <Input
          placeholder="Article title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-xl font-semibold h-12 border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
        />
      </div>

      {/* Metadata row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-2 border-b">
        {/* Folder */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Folder</Label>
          <Select value={folderId || '__none__'} onValueChange={(v) => setFolderId(v === '__none__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="No folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No folder</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Location</Label>
          <Select value={locationId || '__none__'} onValueChange={(v) => setLocationId(v === '__none__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="No location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No location</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tags</Label>
          <div className="flex gap-1.5">
            <Input
              placeholder="Add tag…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              className="h-9"
            />
            <Button type="button" variant="outline" size="sm" onClick={addTag} className="h-9">Add</Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button type="button" onClick={() => removeTag(t)} className="hover:text-destructive">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Source URL */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Source document URL</Label>
        <Input
          placeholder="https://…"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          className="h-9"
        />
      </div>

      {/* Editor */}
      {(!isEditing || initialised) && (
        <TipTapEditor content={body} onChange={setBody} placeholder="Start writing your article…" />
      )}
    </div>
  );
}
