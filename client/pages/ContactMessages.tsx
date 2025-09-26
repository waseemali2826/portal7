import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Trash2 } from "lucide-react";

interface Item {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  ip?: string | null;
}

export default function ContactMessages() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resp = await fetch("/api/contact-submissions");
        const data = await resp.json();
        if (active && data?.items) setItems(data.items as Item[]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this message?")) return;
    const resp = await fetch("/api/contact-submissions/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (resp.ok) setItems((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Contact Messages</h2>
        <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
          <a href="/api/contact-submissions.csv" download>
            <Download className="mr-2 h-4 w-4" /> Download CSV
          </a>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{loading ? "Loading…" : `${items.length} submissions`}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop/tablet table */}
          <div className="hidden md:block">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[4rem]">ID</TableHead>
                    <TableHead className="w-[16rem]">Name</TableHead>
                    <TableHead className="w-[20rem]">Email</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-[11rem]">Date</TableHead>
                    <TableHead className="w-[9rem]">Time</TableHead>
                    <TableHead className="w-[8rem]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => {
                    const d = new Date(it.createdAt);
                    return (
                      <TableRow key={it.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{it.name}</TableCell>
                        <TableCell>{it.email}</TableCell>
                        <TableCell className="max-w-[40rem] whitespace-pre-wrap">{it.message}</TableCell>
                        <TableCell>{d.toLocaleDateString()}</TableCell>
                        <TableCell>{d.toLocaleTimeString()}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="destructive" onClick={() => remove(it.id)}>
                            <Trash2 className="mr-1 h-4 w-4" /> Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile responsive cards */}
          <div className="md:hidden space-y-3">
            {items.map((it, idx) => {
              const d = new Date(it.createdAt);
              return (
                <div key={it.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">#{idx + 1} • {it.name}</div>
                    <Button size="sm" variant="destructive" onClick={() => remove(it.id)}>
                      <Trash2 className="mr-1 h-4 w-4" /> Delete
                    </Button>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground break-all">{it.email}</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm">{it.message}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {d.toLocaleDateString()} • {d.toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
