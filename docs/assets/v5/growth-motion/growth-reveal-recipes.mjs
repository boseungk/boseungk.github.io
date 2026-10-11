export const families = [
  {kind:'flower',name:'꽃',stages:['씨앗','새싹','줄기','봉오리','꽃'],initial:0,wash:'#e9eee0',
    titles:['새싹이 돋았어요','줄기가 자랐어요','봉오리가 맺혔어요','꽃이 피었어요'],
    note:'화분은 그대로. 줄기가 올라오고 잎과 꽃잎이 펼쳐져요.'},
  {kind:'tree',name:'작은 나무',stages:['씨앗','새싹','가지','잎','작은 나무'],initial:3,wash:'#e5ebdd',
    titles:['새싹이 돋았어요','가지가 자랐어요','잎이 돋았어요','잎이 더 풍성해졌어요'],
    note:'기존 가지를 이어 자라고, 빈 곳에 새 잎이 하나씩 열려요.'},
  {kind:'blossom',name:'꽃나무',stages:['씨앗','새싹','가지','봉오리','꽃나무'],initial:3,wash:'#f1ead9',
    titles:['새싹이 돋았어요','가지가 자랐어요','봉오리가 맺혔어요','꽃이 피었어요'],
    note:'가지 끝에 봉오리가 맺히고 꽃잎이 조금씩 다른 속도로 펼쳐져요.'},
  {kind:'succulent',name:'다육식물',stages:['잎','새 뿌리','어린 다육','겹잎','다육식물'],initial:3,wash:'#e2ece5',
    titles:['새 뿌리가 나왔어요','작은 잎이 모였어요','잎이 한 겹 더 자랐어요','풍성한 다육이 되었어요'],
    note:'가운데를 중심으로 두툼한 잎이 바깥쪽으로 차분히 벌어져요.'},
  {kind:'cactus',name:'선인장',stages:['씨앗','싹','몸통','곁가지','꽃 핀 선인장'],initial:3,wash:'#e9ecd9',
    titles:['작은 싹이 올라왔어요','몸통이 자랐어요','곁가지가 자랐어요','작은 꽃이 피었어요'],
    note:'몸통이 길어지고 곁가지가 뻗어요. 마지막에는 꼭대기에 꽃이 열려요.'},
  {kind:'stone',name:'원석',stages:['조약돌','빛든 돌','유리','원석','보석'],initial:2,wash:'#e2e8e8',
    titles:['돌에 빛이 들었어요','맑은 빛을 머금었어요','결정이 드러났어요','보석으로 빛나요'],
    note:'돌의 표면에 빛이 스며들고, 결정이 솟아 면과 색이 또렷해져요.'},
  {kind:'bird',name:'종이새',stages:['종이','접힘','몸체','날개','종이새'],initial:2,wash:'#f1e4d5',
    titles:['첫 접힘이 생겼어요','몸체가 잡혔어요','날개가 펼쳐졌어요','종이새가 되었어요'],
    note:'한 장의 종이가 접힌 선을 중심으로 움직이며 몸체와 날개가 잡혀요.'},
];
export function studyFor(family,from=family.initial) {
  return {...family,from,to:from+1,title:family.titles[from],before:family.stages[from],after:family.stages[from+1],duration:family.kind==='bird'?2800:family.kind==='stone'?2600:2400};
}
export function sourcePoint(kind,x,y) {
  return kind==='stone'?[130+(x-130)*1.25,190+(y-190)*1.25]:kind==='bird'?[125+(x-125)*1.25,188+(y-188)*1.25]:[x,y];
}
export function partAnchor(part) {
  if(part.type==='ellipse')return [part.cx,part.cy];
  const start=part.ops.find(op=>op[0]==='M');return start?[start[1],start[2]]:[130,150];
}
