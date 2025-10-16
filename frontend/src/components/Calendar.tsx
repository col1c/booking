import { useMemo } from "react";

type DayInfo = { date:string; free:number };
type Props = {
  month: string; // 'YYYY-MM'
  days: DayInfo[];
  selectedDate?: string;
  onPrev(): void;
  onNext(): void;
  onPick(date: string): void;
};

export default function Calendar({month, days, selectedDate, onPrev, onNext, onPick}: Props){
  const first = useMemo(()=> new Date(month+"-01T00:00:00"),[month]);
  const monthName = first.toLocaleString(undefined,{month:"long", year:"numeric"});
  const startWeekday = (first.getDay()+6)%7; // Mon=0..Sun=6

  const grid: (DayInfo|null)[] = useMemo(()=>{
    const arr:(DayInfo|null)[] = [];
    for(let i=0;i<startWeekday;i++) arr.push(null);
    days.forEach(d=>arr.push(d));
    while(arr.length%7!==0) arr.push(null);
    return arr;
  },[days, startWeekday]);

  function cap(text:string){
    return text.charAt(0).toUpperCase()+text.slice(1);
  }

  return (
    <div className="bg-white rounded shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="px-2 py-1 border rounded">{"<"}</button>
        <div className="font-semibold">{cap(monthName)}</div>
        <button onClick={onNext} className="px-2 py-1 border rounded">{">"}</button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-gray-500 mb-1">
        {["Mo","Di","Mi","Do","Fr","Sa","So"].map(w=><div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {grid.map((cell,idx)=>{
          if(!cell) return <div key={idx} className="h-12 rounded bg-gray-100 opacity-50"/>;
          const dayNum = parseInt(cell.date.slice(-2));
          const disabled = cell.free===0;
          const active = selectedDate===cell.date;
          return (
            <button key={cell.date} onClick={()=>!disabled && onPick(cell.date)}
              className={`h-12 rounded border flex flex-col items-center justify-center
                ${disabled?'bg-gray-100 text-gray-400':'bg-white'}
                ${active?'border-black':'border-gray-200'}`}>
              <div className="text-sm">{dayNum}</div>
              <div className={`w-10 h-1 mt-1 rounded ${cell.free>0?'bg-green-600':''}`}></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
