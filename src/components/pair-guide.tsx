export default function PairGuide() {
  return (
    <div className="space-y-3 text-sm">
      <p>
        You will see two news articles. Decide how they relate. Read the headline and opening
        lines; use <strong>Open original</strong> if you need more context.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4">Answer</th>
              <th className="py-2 pr-4">When</th>
              <th className="py-2">Example</th>
            </tr>
          </thead>
          <tbody className="align-top">
            <tr className="border-b">
              <td className="py-2 pr-4 font-medium">Same happening</td>
              <td className="py-2 pr-4">Both report the same thing that happened. One news card could hold both.</td>
              <td className="py-2">Two reports on the same landslide rescue.</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4 font-medium">Same ongoing story</td>
              <td className="py-2 pr-4">Different happenings on one thread: a reaction, reply, follow-up or next step.</td>
              <td className="py-2">An announcement, then a party's reaction to it.</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4 font-medium">Different events</td>
              <td className="py-2 pr-4">Separate happenings, even with the same people, court or party.</td>
              <td className="py-2">Two different cases heard by the same Supreme Court bench.</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium">Opinion (tick box)</td>
              <td className="py-2 pr-4">One article is commentary, a column or an opinion piece.</td>
              <td className="py-2">A columnist's take on a news event.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground">
        Quick test: if one article did not exist, would the other still be news? If yes, it is
        a follow-up or a different event. If you genuinely cannot tell, use Skip.
      </p>
    </div>
  );
}