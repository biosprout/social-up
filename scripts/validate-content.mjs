#!/usr/bin/env node
/* SOCIAL UP! 教材データ検証。実行: node scripts/validate-content.mjs（Node.js 18 以上、追加パッケージ不要） */
/* ---- 共通部分（各 repo の validate-content.mjs に同じものを埋め込んでいる） ---- */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const errors = [];
function err(file, id, msg){ errors.push({ file, id, msg }); }

const utf8 = new TextDecoder('utf-8', { fatal: true });
function readJson(file){
  const full = path.join(DATA, file);
  if(!fs.existsSync(full)){ err(file, '', 'ファイルがありません'); return null; }
  let text;
  try{ text = utf8.decode(fs.readFileSync(full)); }
  catch(e){ err(file, '', 'UTF-8 として読めません: ' + e.message); return null; }
  if(text.charCodeAt(0) === 0xFEFF){ err(file, '', '先頭に BOM があります（BOM なしの UTF-8 にしてください）'); text = text.slice(1); }
  try{ return JSON.parse(text); }
  catch(e){ err(file, '', 'JSON として parse できません: ' + e.message); return null; }
}

const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;   // 改行(\n)とCR以外の制御文字
const CR = /\r/;
function checkStr(file, id, key, v, opt = {}){
  if(typeof v !== 'string'){ err(file, id, `${key} は文字列である必要があります（今は ${typeof v}）`); return false; }
  if(!opt.allowEmpty && v.trim() === ''){ err(file, id, `${key} が空です`); return false; }
  if(CTRL.test(v)) err(file, id, `${key} に制御文字が含まれています`);
  if(CR.test(v)) err(file, id, `${key} に CR (\\r) が含まれています`);
  if(v !== v.trim()) err(file, id, `${key} の前後に空白があります`);
  return true;
}
function checkStrArray(file, id, key, v, opt = {}){
  if(!Array.isArray(v)){ err(file, id, `${key} は配列である必要があります`); return false; }
  if(opt.len != null && v.length !== opt.len) err(file, id, `${key} は ${opt.len} 件である必要があります（今は ${v.length}）`);
  if(opt.min != null && v.length < opt.min) err(file, id, `${key} は ${opt.min} 件以上必要です（今は ${v.length}）`);
  v.forEach((x, i) => checkStr(file, id, `${key}[${i}]`, x));
  if(!opt.allowDup && new Set(v).size !== v.length) err(file, id, `${key} に同じ値が重複しています`);
  return true;
}
function checkKeys(file, id, obj, required, optional){
  for(const k of required) if(!(k in obj)) err(file, id, `必須 property "${k}" がありません`);
  const allowed = new Set([...required, ...optional]);
  for(const k of Object.keys(obj)) if(!allowed.has(k)) err(file, id, `未知の property "${k}" があります（許可: ${[...allowed].join(', ')}）`);
}
function checkEnum(file, id, key, v, allowed){
  if(!allowed.includes(v)) err(file, id, `${key} "${v}" は許可されていません（許可: ${allowed.join(', ')}）`);
}
function checkInt(file, id, key, v, min, max){
  if(!Number.isInteger(v)){ err(file, id, `${key} は整数である必要があります（今は ${JSON.stringify(v)}）`); return false; }
  if(v < min || v > max){ err(file, id, `${key} = ${v} は範囲外です（${min}〜${max}）`); return false; }
  return true;
}
function checkIdFormat(file, id, key = 'id'){
  if(typeof id !== 'string' || id === ''){ err(file, String(id), `${key} が空です`); return false; }
  if(!/^[A-Za-z0-9_-]+$/.test(id)){ err(file, id, `${key} に使える文字は英数字・_・- だけです`); return false; }
  return true;
}
/** 4択問題（id, f, lv, q, ch[4], a, ex）の共通チェック */
function checkQuizItem(file, it, i, opt){
  const id = typeof it.id === 'string' ? it.id : `(items[${i}])`;
  if(!it || typeof it !== 'object' || Array.isArray(it)){ err(file, id, 'item はオブジェクトである必要があります'); return; }
  checkKeys(file, id, it, ['id', 'f', 'lv', 'q', 'ch', 'a', 'ex'], []);
  checkIdFormat(file, it.id);
  checkEnum(file, id, 'f', it.f, opt.fields);
  if(opt.expectField && it.f !== opt.expectField) err(file, id, `f "${it.f}" がこのファイルの分野 "${opt.expectField}" と一致しません`);
  if(opt.prefix && typeof it.id === 'string' && opt.prefix[it.f] && !it.id.startsWith(opt.prefix[it.f] + '_'))
    err(file, id, `id は分野 "${it.f}" の接頭辞 "${opt.prefix[it.f]}_" で始める決まりです`);
  checkEnum(file, id, 'lv', it.lv, opt.levels);
  checkStr(file, id, 'q', it.q);
  checkStrArray(file, id, 'ch', it.ch, { len: 4 });
  if(checkInt(file, id, 'a', it.a, 0, 3) && Array.isArray(it.ch) && it.a >= it.ch.length) err(file, id, `a = ${it.a} が選択肢の数を超えています`);
  checkStr(file, id, 'ex', it.ex);
}
function checkDupIds(file, ids, seen, label = 'id'){
  for(const id of ids){
    if(seen.has(id)) err(file, id, `${label} "${id}" が重複しています（先に ${seen.get(id)} にあります）`);
    else seen.set(id, file);
  }
}
/** manifest から参照されていない data/*.json、参照先の欠けを確認 */
function checkDataDir(referenced){
  const files = fs.readdirSync(DATA).filter(f => f.endsWith('.json'));
  for(const f of files) if(!referenced.has(f)) err(f, '', 'data/index.json から参照されていない JSON です（不要なら削除、必要なら manifest に登録）');
  for(const f of referenced) if(!files.includes(f)) err(f, '', 'manifest が参照していますが data/ に存在しません');
  for(const f of fs.readdirSync(DATA)) if(f === '.DS_Store' || f.startsWith('._')) err(f, '', '不要なファイルです（削除してください）');
}
function finish(summary){
  for(const s of summary) console.log('  ' + s);
  if(errors.length){
    console.error(`\n✗ ${errors.length} 件の問題があります:`);
    for(const e of errors) console.error(`  [${e.file}]${e.id ? ' ' + e.id : ''}: ${e.msg}`);
    process.exit(1);
  }
  console.log('\n✓ OK: 問題はありません');
}

/* ---- SOCIAL UP! 固有 ---- */
const FIELDS = ['geo', 'his', 'civ'];
const PREFIX = { geo: 'g', his: 'h', civ: 'c' };
const LEVELS = ['easy', 'std', 'hard'];
const ORDER_MIN = 3, ORDER_MAX = 5;   // 年代整序の1セットあたりの出来事数（現行データは 3〜5）

const idx = readJson('index.json');
if(!idx){ finish([]); }
checkKeys('index.json', '', idx, ['version', 'contentVersion', 'sets', 'total', 'orderTotal'], []);
checkStr('index.json', '', 'contentVersion', idx.contentVersion);   // 教材版 ID（batch 取込で batch_id に更新。空にしない）
if(idx.version !== 1) err('index.json', '', `version は 1 である必要があります（今は ${idx.version}）`);
if(!Array.isArray(idx.sets)) { err('index.json', '', 'sets は配列である必要があります'); finish([]); }

const referenced = new Set(['index.json']);
const seenIds = new Map();
const seenSet = new Map();
let quizSum = 0, orderSum = 0;
const summary = [];
for(const st of idx.sets){
  const sid = st && st.id;
  checkKeys('index.json', sid, st, ['id', 'name', 'file', 'kind', 'count'], []);
  checkStr('index.json', sid, 'name', st.name);
  checkEnum('index.json', sid, 'kind', st.kind, ['quiz', 'order']);
  if(st.kind === 'quiz') checkEnum('index.json', sid, 'id', st.id, FIELDS);
  if(st.kind === 'order' && st.id !== 'order') err('index.json', sid, '年代整序の set id は "order" です');
  if(seenSet.has(st.id)) err('index.json', sid, 'sets の id が重複しています'); seenSet.set(st.id, true);
  if(typeof st.file !== 'string' || !/^[a-z0-9_-]+\.json$/.test(st.file)){ err('index.json', sid, 'file 名が不正です'); continue; }
  referenced.add(st.file);
  const doc = readJson(st.file);
  if(!doc) continue;
  checkKeys(st.file, '', doc, ['id', 'name', 'items'], []);
  if(doc.id !== st.id) err(st.file, '', `ファイル内の id "${doc.id}" が manifest の id "${st.id}" と一致しません`);
  if(doc.name !== st.name) err(st.file, '', `ファイル内の name "${doc.name}" が manifest の name "${st.name}" と一致しません`);
  if(!Array.isArray(doc.items)){ err(st.file, '', 'items は配列である必要があります'); continue; }
  if(st.kind === 'quiz'){
    doc.items.forEach((it, i) => checkQuizItem(st.file, it, i, { fields: FIELDS, levels: LEVELS, expectField: st.id, prefix: PREFIX }));
    quizSum += doc.items.length;
  }else{
    doc.items.forEach((it, i) => {
      const id = typeof it.id === 'string' ? it.id : `(items[${i}])`;
      checkKeys(st.file, id, it, ['id', 'lv', 'q', 'items'], []);
      checkIdFormat(st.file, it.id);
      if(typeof it.id === 'string' && !it.id.startsWith('o_')) err(st.file, id, '年代整序の id は "o_" で始める決まりです');
      checkEnum(st.file, id, 'lv', it.lv, LEVELS);
      checkStr(st.file, id, 'q', it.q);
      if(!Array.isArray(it.items)){ err(st.file, id, 'items（出来事の配列）がありません'); return; }
      if(it.items.length < ORDER_MIN || it.items.length > ORDER_MAX) err(st.file, id, `出来事は ${ORDER_MIN}〜${ORDER_MAX} 件にしてください（今は ${it.items.length}）`);
      const titles = [];
      it.items.forEach((ev, j) => {
        if(!Array.isArray(ev) || ev.length !== 3){ err(st.file, id, `items[${j}] は [できごと, 年代, 補足] の3要素配列である必要があります`); return; }
        checkStr(st.file, id, `items[${j}] できごと`, ev[0]);
        checkStr(st.file, id, `items[${j}] 年代`, ev[1]);
        checkStr(st.file, id, `items[${j}] 補足`, ev[2]);
        titles.push(ev[0]);
      });
      if(new Set(titles).size !== titles.length) err(st.file, id, '同じできごとが重複しています');
    });
    orderSum += doc.items.length;
  }
  checkDupIds(st.file, doc.items.map(x => x.id), seenIds);
  if(st.count !== doc.items.length) err('index.json', sid, `count = ${st.count} が実件数 ${doc.items.length} と一致しません`);
  const byLv = {}; doc.items.forEach(x => { byLv[x.lv] = (byLv[x.lv] || 0) + 1; });
  summary.push(`${st.file}: ${doc.items.length} ${st.kind === 'order' ? 'セット' : '問'} (${LEVELS.map(l => `${l} ${byLv[l] || 0}`).join(' / ')})`);
}
for(const f of FIELDS) if(!seenSet.has(f)) err('index.json', f, `分野 "${f}" の set がありません`);
if(idx.total !== quizSum) err('index.json', '', `total = ${idx.total} が4択の合計 ${quizSum} と一致しません`);
if(idx.orderTotal !== orderSum) err('index.json', '', `orderTotal = ${idx.orderTotal} が年代整序の合計 ${orderSum} と一致しません`);
summary.push(`4択 合計 ${quizSum} 問（total = ${idx.total}）、年代整序 ${orderSum} セット（orderTotal = ${idx.orderTotal}）`);
checkDataDir(referenced);
finish(summary);
