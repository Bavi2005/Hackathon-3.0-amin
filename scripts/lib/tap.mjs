export function readTap(results){
 const lines=(Array.isArray(results)?results:[results]).flatMap(r=>r.rows??[]).flatMap(row=>Object.values(row)).filter(value=>typeof value==='string');
 const plans=lines.filter(line=>/^1\.\.\d+$/.test(line));
 const expected=plans.length===1?Number(plans[0].slice(3)):0;
 const tests=lines.filter(line=>/^(?:not )?ok\s+\d+/.test(line));
 const failures=lines.filter(line=>/^not ok\b|^Bail out!|#\s*(?:SKIP|TODO)\b/i.test(line));
 return{expected,actual:tests.length,failures,passed:expected>0&&tests.length===expected&&failures.length===0};
}
