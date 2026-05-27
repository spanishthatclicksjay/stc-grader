import { useState, useCallback } from "react";
import Papa from "papaparse";

const PATTERN_ANSWERS = {
  "Yo ___ español.": "estudio",
  "Mi amiga ___ inteligente.": "es",
  "Los estudiantes ___ mucha tarea.": "tienen",
  "Me ___ la clase de español.": "gusta",
  "Nosotros ___ a la escuela.": "vamos",
  "La profesora ___ muy simpática.": "es",
  "A Juan le ___ los deportes.": "gustan",
  "Mis amigos y yo ___ música.": "escuchamos",
  "Ayer yo ___ a la tienda después de la escuela.": "fui",
  "Cuando era niño, yo ___ muchos dibujos animados.": "miraba",
  "Anoche nosotros ___ la tarea antes de cenar.": "terminamos",
  "Eran las ocho y ___ mucho frío.": "hacía",
  "Mientras mi mamá cocinaba, yo ___ música.": "escuchaba",
  "Mi profesora quiere que yo ___ más en clase.": "participe",
  "Es importante que los estudiantes ___ la tarea.": "hagan",
  "Mis padres esperan que yo ___ buenas notas": "saque",
  "Dudo que ella ___ la respuesta.": "sepa",
  "Es necesario que nosotros ___ para el examen.": "estudiemos",
};

const LEVEL_GROUPS = {
  "Novice-High": ["Yo ___ español.","Mi amiga ___ inteligente.","Los estudiantes ___ mucha tarea.","Me ___ la clase de español.","Nosotros ___ a la escuela.","La profesora ___ muy simpática."],
  "Intermediate-Low/Mid": ["A Juan le ___ los deportes.","Mis amigos y yo ___ música.","Ayer yo ___ a la tienda después de la escuela.","Anoche nosotros ___ la tarea antes de cenar."],
  "Intermediate-High": ["Cuando era niño, yo ___ muchos dibujos animados.","Eran las ocho y ___ mucho frío.","Mientras mi mamá cocinaba, yo ___ música."],
  "Advanced": ["Mi profesora quiere que yo ___ más en clase.","Es importante que los estudiantes ___ la tarea.","Mis padres esperan que yo ___ buenas notas","Dudo que ella ___ la respuesta.","Es necesario que nosotros ___ para el examen."],
};

const SELF_POS = ["I understand Spanish when I see it written.","I understand Spanish when I hear it.","I can answer questions out loud in Spanish.","I can write Spanish sentences without using a translator.","I know how to start a sentence in Spanish.","I know how to conjugate verbs.","I can create my own Spanish sentences.","I feel confident in Spanish class."];
const SELF_NEG = ["I freeze when I have to speak Spanish.","I memorize for quizzes but forget things later"];

const ACTFL_LEVELS = ["Novice-Low","Novice-Mid","Novice-High","Intermediate-Low","Intermediate-Mid","Intermediate-High","Advanced-Low","Advanced-Mid"];
const LEVEL_COLOR = {"Novice-Low":"#94a3b8","Novice-Mid":"#94a3b8","Novice-High":"#64748b","Intermediate-Low":"#E8A838","Intermediate-Mid":"#E8A838","Intermediate-High":"#f97316","Advanced-Low":"#22c55e","Advanced-Mid":"#16a34a"};
const LEVEL_DESC = {"Novice-Low":"Just starting out. Recognizes a few words but struggles to produce language.","Novice-Mid":"Can identify familiar words and phrases but production is very limited.","Novice-High":"Can handle basic present-tense patterns with memorized chunks.","Intermediate-Low":"Beginning to create with language. Can manage simple present and some past tense.","Intermediate-Mid":"Can narrate and describe using multiple tenses with some accuracy.","Intermediate-High":"Approaching Advanced. Handles most tenses including some subjunctive triggers.","Advanced-Low":"Can use subjunctive and complex structures with good consistency.","Advanced-Mid":"Strong control of grammar; can discuss abstract topics with accuracy."};
const RECS = {"Novice-Low":["Focus on present tense -ar/-er/-ir verb endings","Build core vocabulary (100 most common words)","Practice basic sentence frames: Me llamo… / Tengo… / Me gusta…"],"Novice-Mid":["Solidify present tense conjugation across all pronouns","Introduce ser vs. estar patterns","Begin gustar-type verb structures"],"Novice-High":["Extend to irregular present tense verbs (ir, ser, tener, hacer)","Introduce preterite for completed actions","Practice connecting sentences with y, pero, porque"],"Intermediate-Low":["Contrast preterite vs. imperfect with clear pattern rules","Introduce reflexive verbs and daily routine vocabulary","Build toward paragraph-length writing"],"Intermediate-Mid":["Practice preterite/imperfect contrast in narration","Deepen indirect object pronouns (gustar structures)","Begin multi-paragraph responses"],"Intermediate-High":["Introduce present subjunctive with WEIRDO triggers","Practice complex sentence structures","Target IB/AP writing task types"],"Advanced-Low":["Deepen subjunctive use (past subjunctive, doubt, emotion)","Practice argumentation and opinion writing","IB Paper 1 text type conventions"],"Advanced-Mid":["Refine style and register for IB/AP exam tasks","Practice HL-level analytical writing","Focus on discourse-level coherence and sophistication"]};

function exactCol(row, needle) {
  const key = Object.keys(row).find(k => k.trim() === needle.trim());
  return key ? (row[key] || "").trim() : "";
}
function fuzzyCol(row, needle) {
  const key = Object.keys(row).find(k => k.toLowerCase().includes(needle.toLowerCase().substring(0,25)));
  return key ? (row[key] || "").trim() : "";
}

function scorePattern(row) {
  let correct = 0, total = 0;
  const levelScores = {};
  Object.entries(LEVEL_GROUPS).forEach(([level, qs]) => {
    let lc = 0;
    qs.forEach(q => {
      const answer = exactCol(row, q).toLowerCase();
      if (answer) { total++; if (answer === PATTERN_ANSWERS[q]) { correct++; lc++; } }
    });
    levelScores[level] = { correct: lc, total: qs.length };
  });
  return { correct, total, pct: total > 0 ? Math.round((correct/total)*100) : 0, levelScores };
}

function scoreSelf(row) {
  let posSum=0,posN=0,negSum=0,negN=0;
  SELF_POS.forEach(q => { const v=parseInt(exactCol(row,q)); if(!isNaN(v)){posSum+=v;posN++;} });
  SELF_NEG.forEach(q => { const v=parseInt(exactCol(row,q)); if(!isNaN(v)){negSum+=v;negN++;} });
  const posAvg=posN>0?posSum/posN:0, negAvg=negN>0?negSum/negN:0;
  return { posAvg:posAvg.toFixed(1), negAvg:negAvg.toFixed(1), confidence:Math.round((posAvg/5)*70+((5-negAvg)/5)*30) };
}

function getACTFL(pat) {
  const ls=pat.levelScores;
  const nh=ls["Novice-High"]?ls["Novice-High"].correct/ls["Novice-High"].total:0;
  const il=ls["Intermediate-Low/Mid"]?ls["Intermediate-Low/Mid"].correct/ls["Intermediate-Low/Mid"].total:0;
  const ih=ls["Intermediate-High"]?ls["Intermediate-High"].correct/ls["Intermediate-High"].total:0;
  const adv=ls["Advanced"]?ls["Advanced"].correct/ls["Advanced"].total:0;
  if(adv>=0.8&&ih>=0.8) return "Advanced-Mid";
  if(adv>=0.6&&ih>=0.67) return "Advanced-Low";
  if(ih>=0.67&&il>=0.75) return "Intermediate-High";
  if(il>=0.5&&nh>=0.83) return "Intermediate-Mid";
  if(il>=0.25&&nh>=0.67) return "Intermediate-Low";
  if(nh>=0.5) return "Novice-High";
  if(nh>=0.33||pat.pct>=20) return "Novice-Mid";
  return "Novice-Low";
}

function analyzeStudent(row) {
  const pat=scorePattern(row), self=scoreSelf(row), actfl=getACTFL(pat);
  const w1=exactCol(row,"Write 5 Spanish sentences about yourself.")||fuzzyCol(row,"sentences about yourself");
  const w2=exactCol(row,"Write 5 sentences in Spanish about a memorable day or event from your past.")||fuzzyCol(row,"memorable day");
  const w3=exactCol(row,"Write 5 sentences in Spanish giving advice to a student who wants to do better in Spanish class.")||fuzzyCol(row,"giving advice");
  return {
    studentName: row["Student Name"]||"Unknown",
    grade: row["Student Grade Level"]||"",
    course: row["Current Spanish Course"]||"",
    classGrade: row["Current Grade in Spanish"]||"",
    struggles: row["What does your child struggle with most?"]||"",
    statement: row["Which statement sounds most like your child?"]||"",
    pat, self, actfl, w1, w2, w3,
    hasWriting: w1.length>5||w2.length>5||w3.length>5,
    recs: RECS[actfl]||[],
  };
}

// ── AI writing eval using plain text response then parse ──────────────────
async function aiEvalWriting(student) {
  const { w1, w2, w3, actfl, studentName } = student;

  const systemPrompt = `You are a Spanish language evaluator. You must respond with ONLY a raw JSON object. No explanation, no markdown, no code fences. Start your response with { and end with }.`;

  const userPrompt = `Evaluate these Spanish writing samples from student "${studentName}" (grammar test level: ${actfl}).

Sample 1: ${w1 || "not provided"}
Sample 2: ${w2 || "not provided"}  
Sample 3: ${w3 || "not provided"}

Return this exact JSON structure:
{"writingLevel":"Intermediate-Mid","strengths":["strength one","strength two"],"gaps":["gap one","gap two"],"summary":"Two sentence summary.","alignsWithGrammar":true,"discrepancyNote":""}

Use one of these for writingLevel: Novice-Low, Novice-Mid, Novice-High, Intermediate-Low, Intermediate-Mid, Intermediate-High, Advanced-Low, Advanced-Mid`;

  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const rawText = await res.text();

  if (!res.ok) throw new Error(`API error ${res.status}: ${rawText.substring(0,200)}`);

  let responseData;
  try { responseData = JSON.parse(rawText); }
  catch(e) { throw new Error(`Could not parse API envelope: ${rawText.substring(0,200)}`); }

  const content = (responseData.content || []).map(b => b.text || "").join("").trim();
  if (!content) throw new Error(`Empty content in response. Full response: ${rawText.substring(0,300)}`);

  // Find JSON in the content
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON object found. Content was: ${content.substring(0,300)}`);

  try {
    return JSON.parse(jsonMatch[0]);
  } catch(e) {
    throw new Error(`JSON parse failed: ${e.message}. Content: ${content.substring(0,300)}`);
  }
}

// ── Components ──────────────────────────────────────────────────────────────
const Badge = ({ level }) => (
  <span style={{ background:LEVEL_COLOR[level]||"#94a3b8", color:"#fff", padding:"3px 10px", borderRadius:"20px", fontSize:"11px", fontWeight:"700", letterSpacing:"0.5px", fontFamily:"Montserrat,sans-serif" }}>{level}</span>
);

const Bar = ({ pct, color="#E8614A" }) => (
  <div style={{ background:"#e2e8f0", borderRadius:"4px", height:"7px", overflow:"hidden" }}>
    <div style={{ width:`${Math.min(pct,100)}%`, background:color, height:"100%", transition:"width .6s ease" }} />
  </div>
);

function StudentCard({ student, index }) {
  const [open, setOpen] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const color = LEVEL_COLOR[student.actfl]||"#94a3b8";

  async function runAI() {
    setAiLoading(true); setAiError(""); setAiResult(null);
    try {
      const result = await aiEvalWriting(student);
      setAiResult(result);
    } catch(e) {
      setAiError(e.message||"Unknown error");
    }
    setAiLoading(false);
  }

  return (
    <div style={{ background:"#fff", borderRadius:"12px", border:"1px solid #e2e8f0", marginBottom:"14px", overflow:"hidden", boxShadow:"0 2px 8px rgba(15,26,53,.06)", fontFamily:"Montserrat,sans-serif" }}>
      <div onClick={() => setOpen(o=>!o)} style={{ padding:"14px 18px", cursor:"pointer", display:"flex", alignItems:"center", gap:"12px", borderLeft:`5px solid ${color}` }}>
        <div style={{ width:34, height:34, borderRadius:"50%", background:color, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"700", fontSize:"13px", flexShrink:0 }}>{index+1}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:"700", fontSize:"14px", color:"#0F1A35" }}>{student.studentName}</div>
          <div style={{ fontSize:"11px", color:"#64748b", marginTop:2 }}>{student.grade}{student.course?` · ${student.course}`:""}{student.classGrade?` · ${student.classGrade}`:""}</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <Badge level={student.actfl} />
          <span style={{ color:"#cbd5e1", fontSize:16 }}>{open?"▲":"▼"}</span>
        </div>
      </div>

      <div style={{ padding:"8px 18px 8px 67px", background:"#f8fafc", borderTop:"1px solid #f1f5f9", fontSize:"11px", color:"#64748b", display:"flex", gap:18 }}>
        <span>Grammar: <strong style={{ color:"#0F1A35" }}>{student.pat.pct}%</strong></span>
        <span>Confidence: <strong style={{ color:"#0F1A35" }}>{student.self.confidence}%</strong></span>
        <span>Self-avg: <strong style={{ color:"#0F1A35" }}>{student.self.posAvg}/5</strong></span>
      </div>

      {open && (
        <div style={{ padding:"18px", borderTop:"1px solid #f1f5f9" }}>
          <div style={{ background:`${color}18`, border:`1px solid ${color}50`, borderRadius:8, padding:"10px 14px", marginBottom:14 }}>
            <div style={{ fontWeight:"700", color, fontSize:"12px", marginBottom:3 }}>ACTFL {student.actfl}</div>
            <div style={{ fontSize:"12px", color:"#334155", lineHeight:1.5 }}>{LEVEL_DESC[student.actfl]}</div>
          </div>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontWeight:"700", fontSize:"12px", color:"#0F1A35", marginBottom:8 }}>Grammar Pattern Scores</div>
            {Object.entries(student.pat.levelScores).map(([lvl,sc]) => (
              <div key={lvl} style={{ marginBottom:7 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", marginBottom:2 }}>
                  <span style={{ color:"#64748b" }}>{lvl}</span>
                  <span style={{ fontWeight:"600", color:"#0F1A35" }}>{sc.correct}/{sc.total}</span>
                </div>
                <Bar pct={sc.total>0?(sc.correct/sc.total)*100:0} color={color} />
              </div>
            ))}
          </div>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontWeight:"700", fontSize:"12px", color:"#0F1A35", marginBottom:8 }}>Student Self-Assessment</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {[{label:"Confidence Avg",val:`${student.self.posAvg}/5`},{label:"Anxiety/Avoidance",val:`${student.self.negAvg}/5`}].map(({label,val}) => (
                <div key={label} style={{ background:"#f8fafc", borderRadius:8, padding:"9px 12px" }}>
                  <div style={{ fontSize:"10px", color:"#94a3b8", marginBottom:2 }}>{label}</div>
                  <div style={{ fontWeight:"700", fontSize:"18px", color:"#0F1A35" }}>{val}</div>
                </div>
              ))}
            </div>
            {student.struggles && <div style={{ marginTop:7, fontSize:"11px", color:"#64748b" }}><strong>Struggles with:</strong> {student.struggles}</div>}
          </div>

          <div style={{ marginBottom:14 }}>
            <div style={{ fontWeight:"700", fontSize:"12px", color:"#0F1A35", marginBottom:7 }}>Recommended Focus Areas</div>
            {student.recs.map((r,i) => (
              <div key={i} style={{ display:"flex", gap:6, marginBottom:5, fontSize:"11px", color:"#334155" }}>
                <span style={{ color:"#E8614A", fontWeight:"700", flexShrink:0 }}>→</span>{r}
              </div>
            ))}
          </div>

          {student.hasWriting && (
            <div>
              <div style={{ fontWeight:"700", fontSize:"12px", color:"#0F1A35", marginBottom:8 }}>Writing Sample Analysis</div>
              {!aiResult && !aiLoading && (
                <button onClick={runAI} style={{ background:"#0F1A35", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontSize:"12px", cursor:"pointer", fontFamily:"Montserrat,sans-serif", fontWeight:"600" }}>
                  ✦ Analyze Writing with AI
                </button>
              )}
              {aiLoading && <div style={{ fontSize:"12px", color:"#94a3b8", fontStyle:"italic", padding:"8px 0" }}>Analyzing writing samples…</div>}
              {aiError && (
                <div style={{ fontSize:"11px", color:"#ef4444", background:"#fef2f2", borderRadius:6, padding:"8px 10px", marginTop:4, wordBreak:"break-all" }}>
                  {aiError}
                </div>
              )}
              {aiResult && (
                <div style={{ background:"#f8fafc", borderRadius:8, padding:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:"11px", color:"#64748b" }}>Writing level:</span>
                    <Badge level={aiResult.writingLevel} />
                    {!aiResult.alignsWithGrammar && <span style={{ fontSize:"10px", color:"#E8614A", fontStyle:"italic" }}>⚠ Differs from grammar score</span>}
                  </div>
                  <p style={{ fontSize:"12px", color:"#334155", lineHeight:1.5, marginBottom:10 }}>{aiResult.summary}</p>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <div>
                      <div style={{ fontSize:"10px", fontWeight:"700", color:"#22c55e", marginBottom:4 }}>STRENGTHS</div>
                      {(aiResult.strengths||[]).map((s,i) => <div key={i} style={{ fontSize:"11px", color:"#334155", marginBottom:3 }}>✓ {s}</div>)}
                    </div>
                    <div>
                      <div style={{ fontSize:"10px", fontWeight:"700", color:"#E8614A", marginBottom:4 }}>GAPS</div>
                      {(aiResult.gaps||[]).map((g,i) => <div key={i} style={{ fontSize:"11px", color:"#334155", marginBottom:3 }}>✗ {g}</div>)}
                    </div>
                  </div>
                  {aiResult.discrepancyNote && <div style={{ marginTop:8, fontSize:"10px", color:"#E8614A", fontStyle:"italic" }}>{aiResult.discrepancyNote}</div>}
                  {aiResult && <button onClick={()=>{setAiResult(null);}} style={{ marginTop:10, background:"none", border:"1px solid #e2e8f0", borderRadius:6, padding:"3px 10px", cursor:"pointer", fontSize:"10px", color:"#94a3b8" }}>Re-analyze</button>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [filter, setFilter] = useState("All");

  const parse = useCallback((file) => {
    if (!file) return;
    setLoading(true); setError(""); setFileName(file.name);
    Papa.parse(file, {
      header:true, skipEmptyLines:true,
      complete:({data}) => { if(!data.length){setError("No data found.");setLoading(false);return;} setStudents(data.map(analyzeStudent)); setLoading(false); },
      error:()=>{ setError("Could not parse CSV."); setLoading(false); },
    });
  }, []);

  const levelCounts = students.reduce((a,s)=>({...a,[s.actfl]:(a[s.actfl]||0)+1}),{});
  const shown = filter==="All"?students:students.filter(s=>s.actfl===filter);

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9", fontFamily:"Montserrat,sans-serif" }}>
      <div style={{ background:"#0F1A35", padding:"16px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:38, height:38, borderRadius:"50%", background:"linear-gradient(135deg,#E8A838,#C97B2E)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:"800", color:"#fff", fontSize:"12px", letterSpacing:"1px" }}>STC</div>
        <div>
          <div style={{ color:"#fff", fontWeight:"700", fontSize:"15px" }}>Spanish That Clicks</div>
          <div style={{ color:"#94a3b8", fontSize:"10px" }}>Diagnostic Grader · ACTFL Proficiency Framework</div>
        </div>
      </div>

      <div style={{ maxWidth:740, margin:"0 auto", padding:"20px 14px" }}>
        {!students.length && !loading && (
          <div onDrop={e=>{e.preventDefault();parse(e.dataTransfer.files[0]);}} onDragOver={e=>e.preventDefault()} style={{ border:"2px dashed #cbd5e1", borderRadius:16, padding:"44px 20px", textAlign:"center", background:"#fff" }}>
            <div style={{ fontSize:38, marginBottom:10 }}>📊</div>
            <div style={{ fontWeight:"700", fontSize:"17px", color:"#0F1A35", marginBottom:6 }}>Upload Tally CSV Export</div>
            <div style={{ color:"#64748b", fontSize:"12px", marginBottom:18 }}>In Tally: Results → Export → CSV · Then drop it here or click below</div>
            <label style={{ background:"#E8614A", color:"#fff", padding:"9px 22px", borderRadius:8, cursor:"pointer", fontWeight:"600", fontSize:"13px", display:"inline-block" }}>
              Choose File
              <input type="file" accept=".csv" onChange={e=>parse(e.target.files[0])} style={{ display:"none" }} />
            </label>
            {error && <div style={{ color:"#ef4444", marginTop:10, fontSize:"12px" }}>{error}</div>}
          </div>
        )}

        {loading && <div style={{ textAlign:"center", padding:48, color:"#64748b" }}><div style={{ fontSize:28, marginBottom:8 }}>⏳</div>Analyzing responses…</div>}

        {students.length>0 && (
          <>
            <div style={{ background:"#fff", borderRadius:12, padding:"14px 18px", marginBottom:16, border:"1px solid #e2e8f0", boxShadow:"0 2px 8px rgba(15,26,53,.06)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontWeight:"700", color:"#0F1A35", fontSize:"14px" }}>{students.length} student{students.length!==1?"s":""} · {fileName}</div>
                <button onClick={()=>{setStudents([]);setFileName("");setFilter("All");}} style={{ background:"none", border:"1px solid #e2e8f0", borderRadius:6, padding:"3px 10px", cursor:"pointer", fontSize:"11px", color:"#64748b" }}>Upload new</button>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                <button onClick={()=>setFilter("All")} style={{ background:filter==="All"?"#0F1A35":"#f1f5f9", color:filter==="All"?"#fff":"#64748b", border:"1px solid #e2e8f0", borderRadius:20, padding:"3px 12px", cursor:"pointer", fontSize:"11px", fontWeight:"600", fontFamily:"Montserrat,sans-serif" }}>All ({students.length})</button>
                {ACTFL_LEVELS.filter(l=>levelCounts[l]).map(l => (
                  <button key={l} onClick={()=>setFilter(filter===l?"All":l)} style={{ background:filter===l?LEVEL_COLOR[l]:`${LEVEL_COLOR[l]}22`, color:filter===l?"#fff":LEVEL_COLOR[l], border:`1px solid ${LEVEL_COLOR[l]}`, borderRadius:20, padding:"3px 12px", cursor:"pointer", fontSize:"11px", fontWeight:"600", fontFamily:"Montserrat,sans-serif" }}>{l} ({levelCounts[l]})</button>
                ))}
              </div>
            </div>
            {shown.map((s,i) => <StudentCard key={i} student={s} index={students.indexOf(s)} />)}
          </>
        )}
      </div>
    </div>
  );
}
