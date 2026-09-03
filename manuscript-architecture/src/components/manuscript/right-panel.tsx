'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useManuscript } from '@/lib/store'
import { Inspector } from './inspector'
import { ChatPanel } from './chat-panel'
import { BoardPanel } from './board-panel'

export function RightPanel() {
  const activeTab = useManuscript((s) => s.activeTab)
  const setTab = useManuscript((s) => s.setTab)
  const changeRequests = useManuscript((s) => s.changeRequests)
  const openCRs = changeRequests.filter((c) => c.status === 'open').length

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setTab(v as typeof activeTab)}
      className="flex h-full flex-col gap-0 rounded-xl border border-stone-200 bg-white shadow-sm"
    >
      <TabsList className="h-10 w-full shrink-0 justify-stretch rounded-none border-b border-stone-200 bg-stone-50 p-0">
        {(
          [
            ['inspector', 'Inspector'],
            ['chat', 'Chat'],
            ['board', `Board${openCRs > 0 ? ` (${openCRs})` : ''}`],
          ] as const
        ).map(([value, label]) => (
          <TabsTrigger
            key={value}
            value={value}
            className="h-10 flex-1 rounded-none border-b-2 border-transparent bg-transparent px-2 text-xs font-medium text-stone-500 shadow-none data-[state=active]:border-[#227fad] data-[state=active]:bg-white data-[state=active]:text-stone-900"
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="inspector" className="mt-0 min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        <div className="h-full overflow-y-auto">
          <Inspector />
        </div>
      </TabsContent>
      <TabsContent value="chat" className="mt-0 min-h-0 flex-1">
        <ChatPanel />
      </TabsContent>
      <TabsContent value="board" className="mt-0 min-h-0 flex-1 overflow-y-auto">
        <BoardPanel />
      </TabsContent>
    </Tabs>
  )
}
