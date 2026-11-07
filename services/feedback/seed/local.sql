-- LOCAL DEVELOPMENT ONLY. FICTIONAL TEST DATA. NEVER RUN AGAINST PRODUCTION.
-- Every nickname, idea, comment, status and operator reply below is made up to
-- exercise the board UI. Apply with `npm run db:seed` (local D1 only, no --remote).
-- Seed ids start with 5eed0000- and seed-visitor-. Do not publish them anywhere.
-- Re-runnable: it empties the local tables first.
-- Contents: 26 public ideas (3 completed, 3 planned, 4 reviewing, 16 open) and one hidden idea,
-- 0 to 28 votes each, 23 visitor comments on idea 01, one hidden comment, and operator replies
-- on every completed and planned idea plus one reviewing idea (idea 13 has two replies; the later one
-- mentions /news/#feedback-board, so the card shows a linked reply).
DELETE FROM votes;
DELETE FROM comments;
DELETE FROM ideas;
DELETE FROM visitors;

INSERT INTO visitors(id,token_hash,expires_at)
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<32)
SELECT printf('seed-visitor-%02d',i),NULL,4102444800000 FROM n;

INSERT INTO ideas(id,visitor_id,nickname,body,created_at,hidden,client_request_id,status) VALUES
('5eed0000-0000-4000-8000-000000000001','seed-visitor-02','하루','집중 끝나고 나서 방에 놀러 온 동물들이 한 줄로 요약돼서 보이면 좋겠어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000002','seed-visitor-03','🐾 루미','방마다 다른 배경 음악을 고를 수 있으면 좋겠어요.

지금은 소리가 하나라서, 숲 방에서는 새소리, 호수 방에서는 물소리처럼 분위기에 맞게 바뀌면 집중이 훨씬 잘 될 것 같아요.

무음 모드일 때는 아예 꺼지는 것도 같이 부탁드려요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-40*60000,0,lower(hex(randomblob(16))),'planned'),
('5eed0000-0000-4000-8000-000000000003','seed-visitor-04','모카','집중 타이머를 끝내기 전에 5분만 더 할 수 있는 버튼이 있으면 좋겠어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-2*86400000-5*60000,0,lower(hex(randomblob(16))),'completed'),
('5eed0000-0000-4000-8000-000000000004','seed-visitor-05','','위젯으로 오늘의 집중 시간을 홈 화면에서 바로 볼 수 있으면 좋겠습니다.',CAST(unixepoch('subsec')*1000 AS INTEGER)-2*86400000-300*60000,0,lower(hex(randomblob(16))),'reviewing'),
('5eed0000-0000-4000-8000-000000000005','seed-visitor-06','콩이','Please add an English-friendly onboarding. I love the quiet look of the app, but the first screens were hard to follow without the Korean copy.',CAST(unixepoch('subsec')*1000 AS INTEGER)-3*86400000-90*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000006','seed-visitor-07','서윤','동물마다 좋아하는 소품이 다르면 방을 꾸미는 재미가 더 생길 것 같아요. 고양이는 창가, 토끼는 풀밭 같은 식으로요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-4*86400000-15*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000007','seed-visitor-08','밤하늘','밤 모드에서 방의 조명이 천천히 어두워지는 연출을 더 길게 볼 수 있으면 좋겠어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-5*86400000-200*60000,0,lower(hex(randomblob(16))),'planned'),
('5eed0000-0000-4000-8000-000000000008','seed-visitor-09','ㅇㅇ','<b>굵게</b> & <script>alert(1)</script> 같은 글자도 그대로 보여야 하나요? 테스트 삼아 적어 봅니다.',CAST(unixepoch('subsec')*1000 AS INTEGER)-6*86400000-10*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000009','seed-visitor-10','다온','방을 꾸미는 시간이 길어질수록 집중 시간과 꾸미기 시간이 자연스럽게 섞였으면 좋겠어요. 지금은 집중을 끝낸 뒤에야 가구를 고를 수 있는데, 하루 중 가장 편안한 순간이 그때라서 그 짧은 시간에 너무 많은 선택을 하게 돼요. 예를 들어 오늘 어떤 동물이 방에 놀러 왔는지, 어떤 소품이 새로 열렸는지를 한눈에 모아서 보여 주면 훨씬 여유롭게 고를 수 있을 것 같습니다. 방을 꾸미는 시간이 길어질수록 집중 시간과 꾸미기 시간이 자연스럽게 섞였으면 좋겠어요. 지금은 집중을 끝낸 뒤에야 가구를 고를 수 있는데, 하루 중 가장 편안한 순간이 그때라서 그 짧은 시간에 너무 많은 선택을 하게 돼요. 예를 들어 오늘 어떤 동물이 방에 놀러 왔는지, 어떤 소품이 새로 열렸는지를 한눈에 모아서 보여 주면 훨씬 여유롭게 고를 수 있을 것 같습니다. 방을 꾸미는 시간이 길어질수록 집중 시간과 꾸미기 시간이 자연스럽게 섞였으면 좋겠어요. 지금은 집중을 끝낸 뒤에야 가구를 고를 수 있는데, 하루 중 가장 편안한 순간이 그때라서 그 짧은 시간에 너무 많은 선택을 하게 돼요. 예를 들어 오늘 어떤 동물이 방에 놀러 왔는지, 어떤 소품이 새로 열렸는지를 한눈에 모아서 보여 주면 훨씬 여유롭게 고를 수 있을 것 같습니다. 방을 꾸미는 시간이 길어질수록 집중 시간과 꾸미기 시간이 자연스럽게 섞였으면 좋겠어요. 지금은 집중을 끝낸 뒤에야 가구를 고를 수 있는데, 하루 중 가장 편안한 순간이 그때라서 그 짧은 시간에 너무 많은 선택을 하게 돼요. 예를 들어 오늘 어떤 동물이 방에 놀러 왔는지, 어떤 소품이 새로 열렸는지를 한눈에 모아서 보여 주면 훨씬 여유롭게 고를 수 있을 것 같습니다. 방을 꾸미는 시간이 길어질수록 집중 시간과 꾸미기 시간이 자연스럽게 섞였으면 좋겠어요. 지금은 집중을 끝낸 뒤에야 가구를 고를 수 있는데, 하루 중 가장 편안한 순간이 그때라서 그 짧은 시간에 너무 많은 선택을 하게 돼요. 예를 들어 오늘 어떤 동물이 방에 놀러 왔는지, 어떤 소품이 새로 열렸는지를 한눈에 모아서 보여 주면 훨씬 여유롭게 고를 수 있을 것 같습니다. 방을 꾸미는 시간이 길어질수록 집중 시간과 꾸미기 시간이 자연스럽게 섞였으면 좋겠어요. 지금은 집중을 끝낸 뒤에야 가구를 고를 수 있는데, 하루 중 가장 편안한 순간이 그때라서 그 짧은 시간에 너무 많은 선택을 하게 돼요. 예를 들어 오늘 어떤 동물이 방에 놀러 왔는지, 어떤 소품이 새로 열렸는지를 한눈에 모아서 보여 주면 훨씬 여유롭게 고를 수 있을 것 같습니다.',CAST(unixepoch('subsec')*1000 AS INTEGER)-7*86400000-60*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000010','seed-visitor-11','지우','친구와 방을 구경만 할 수 있는 읽기 전용 링크가 있으면 좋겠어요. 로그인 없이 보기만 가능하면 충분해요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-8*86400000-30*60000,0,lower(hex(randomblob(16))),'reviewing'),
('5eed0000-0000-4000-8000-000000000011','seed-visitor-12','سارة','أتمنى أن يكون هناك خيار لتغيير حجم الخط داخل التطبيق، فبعض النصوص صغيرة قليلاً على الشاشات الصغيرة.',CAST(unixepoch('subsec')*1000 AS INTEGER)-9*86400000-500*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000012','seed-visitor-13','נועה','אשמח אם אפשר יהיה לבחור יום התחלה אחר לשבוע בסטטיסטיקה של הריכוז.',CAST(unixepoch('subsec')*1000 AS INTEGER)-10*86400000-20*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000013','seed-visitor-14','하늘달','앱 아이콘을 따로 고를 수 있으면 좋겠어요. 방 분위기랑 맞춰서 바꾸고 싶어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-12*86400000-45*60000,0,lower(hex(randomblob(16))),'completed'),
('5eed0000-0000-4000-8000-000000000014','seed-visitor-15','가을','집중 중에 알림이 울리는 앱이 있으면 방이 흔들리지 않게 해 주세요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-13*86400000-0*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000015','seed-visitor-16','바람','식물이 자라는 속도가 눈에 보이는 작은 기록이 있으면 좋겠어요.

주 단위로 모아서 보여 주면 더 좋아요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-14*86400000-120*60000,0,lower(hex(randomblob(16))),'reviewing'),
('5eed0000-0000-4000-8000-000000000016','seed-visitor-17','abcdefghijklmnopqrstuvwx','24자 닉네임도 카드에서 잘리지 않는지 확인용으로 남겨요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-15*86400000-75*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000017','seed-visitor-18','수달','방 안 동물을 쓰다듬으면 가볍게 반응하는 동작이 늘어났으면 해요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-17*86400000-10*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000018','seed-visitor-19','겨울잠','집중 시간 목표를 요일별로 다르게 정하고 싶어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-19*86400000-35*60000,0,lower(hex(randomblob(16))),'planned'),
('5eed0000-0000-4000-8000-000000000019','seed-visitor-20','나무','태블릿에서도 방이 크게 보이면 좋겠어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-21*86400000-700*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000020','seed-visitor-21','','익명으로 남깁니다. 세계 여러 나라의 방 배경이 하나씩 추가되면 좋겠어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-23*86400000-25*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000021','seed-visitor-22','오리','계정 없이 기기 안에만 저장되는 점이 마음에 들어요. 백업 방법을 한 번만 더 알기 쉽게 안내해 주세요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-26*86400000-15*60000,0,lower(hex(randomblob(16))),'completed'),
('5eed0000-0000-4000-8000-000000000022','seed-visitor-23','보리','집중이 끝났을 때 진동 세기를 고를 수 있으면 좋겠어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-28*86400000-360*60000,0,lower(hex(randomblob(16))),'reviewing'),
('5eed0000-0000-4000-8000-000000000023','seed-visitor-24','은하','오늘 하루를 시작할 때 방이 인사하는 짧은 문구가 있으면 따뜻할 것 같아요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-31*86400000-5*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000024','seed-visitor-25','🌿','소품 도감이 있어서 아직 못 만난 소품을 알 수 있으면 좋겠어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-34*86400000-50*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000025','seed-visitor-26','호두','야간에 눈이 덜 부시도록 밝기 단계를 하나 더 만들어 주세요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-37*86400000-15*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000026','seed-visitor-27','미니','동물이 자는 모습을 오래 볼 수 있으면 좋겠어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-40*86400000-0*60000,0,lower(hex(randomblob(16))),'open'),
('5eed0000-0000-4000-8000-000000000027','seed-visitor-05','숨김','LOCAL TEST: hidden idea. This must never appear in any public response.',CAST(unixepoch('subsec')*1000 AS INTEGER)-60000,1,lower(hex(randomblob(16))),'completed');

INSERT INTO votes(idea_id,visitor_id)
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<32),
want(id,k) AS (VALUES
  ('5eed0000-0000-4000-8000-000000000001',28),
  ('5eed0000-0000-4000-8000-000000000002',24),
  ('5eed0000-0000-4000-8000-000000000003',22),
  ('5eed0000-0000-4000-8000-000000000004',19),
  ('5eed0000-0000-4000-8000-000000000005',17),
  ('5eed0000-0000-4000-8000-000000000006',15),
  ('5eed0000-0000-4000-8000-000000000007',14),
  ('5eed0000-0000-4000-8000-000000000008',12),
  ('5eed0000-0000-4000-8000-000000000009',11),
  ('5eed0000-0000-4000-8000-000000000010',10),
  ('5eed0000-0000-4000-8000-000000000011',9),
  ('5eed0000-0000-4000-8000-000000000012',8),
  ('5eed0000-0000-4000-8000-000000000013',8),
  ('5eed0000-0000-4000-8000-000000000014',7),
  ('5eed0000-0000-4000-8000-000000000015',6),
  ('5eed0000-0000-4000-8000-000000000016',5),
  ('5eed0000-0000-4000-8000-000000000017',5),
  ('5eed0000-0000-4000-8000-000000000018',4),
  ('5eed0000-0000-4000-8000-000000000019',4),
  ('5eed0000-0000-4000-8000-000000000020',3),
  ('5eed0000-0000-4000-8000-000000000021',3),
  ('5eed0000-0000-4000-8000-000000000022',2),
  ('5eed0000-0000-4000-8000-000000000023',2),
  ('5eed0000-0000-4000-8000-000000000024',1),
  ('5eed0000-0000-4000-8000-000000000025',0),
  ('5eed0000-0000-4000-8000-000000000026',0),
  ('5eed0000-0000-4000-8000-000000000027',3))
SELECT want.id, printf('seed-visitor-%02d',n.i) FROM want JOIN n ON n.i<=want.k;

INSERT INTO comments(id,idea_id,visitor_id,nickname,body,created_at,hidden,is_operator,client_request_id) VALUES
('5eed0001-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-000000000001','seed-visitor-02','','저도 같은 생각이에요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+5*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000002','5eed0000-0000-4000-8000-000000000001','seed-visitor-03','민트','이거 정말 기다리고 있었어요!',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+42*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000003','5eed0000-0000-4000-8000-000000000001','seed-visitor-04','포도','있으면 좋겠지만 너무 복잡해지지 않았으면 해요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+79*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000004','5eed0000-0000-4000-8000-000000000001','seed-visitor-05','🐾','저는 이쪽이 더 편할 것 같아요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+116*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000005','5eed0000-0000-4000-8000-000000000001','seed-visitor-06','해바라기','좋은 의견 감사합니다.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+153*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000006','5eed0000-0000-4000-8000-000000000001','seed-visitor-07','구름','<i>태그</i> 같은 글자는 그대로 보이나요?',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+190*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000007','5eed0000-0000-4000-8000-000000000001','seed-visitor-08','','한 번 써 보면 금방 익숙해질 것 같아요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+227*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000008','5eed0000-0000-4000-8000-000000000001','seed-visitor-09','민트','조용한 앱이라 이런 기능이 더 잘 어울려요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+264*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000009','5eed0000-0000-4000-8000-000000000001','seed-visitor-10','포도','저도 출퇴근길에 자주 쓰는데 공감해요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+301*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000010','5eed0000-0000-4000-8000-000000000001','seed-visitor-11','🐾','Agreed, this would be great.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+338*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000011','5eed0000-0000-4000-8000-000000000001','seed-visitor-12','해바라기','작은 것부터 먼저 되면 좋겠어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+375*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000012','5eed0000-0000-4000-8000-000000000001','seed-visitor-13','구름','동의합니다.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+412*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000013','5eed0000-0000-4000-8000-000000000001','seed-visitor-14','','여기에 한 표 더 보태요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+449*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000014','5eed0000-0000-4000-8000-000000000001','seed-visitor-15','민트','저는 반대로 지금이 더 좋아요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+486*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000015','5eed0000-0000-4000-8000-000000000001','seed-visitor-16','포도','설정에서 끌 수 있으면 더 좋겠어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+523*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000016','5eed0000-0000-4000-8000-000000000001','seed-visitor-17','🐾','😊',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+560*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000017','5eed0000-0000-4000-8000-000000000001','seed-visitor-18','해바라기','이 기능이 생기면 친구에게도 추천할래요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+597*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000018','5eed0000-0000-4000-8000-000000000001','seed-visitor-19','구름','아이패드에서도 되면 완벽해요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+634*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000019','5eed0000-0000-4000-8000-000000000001','seed-visitor-20','','천천히 해 주셔도 괜찮아요. 응원합니다.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+671*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000020','5eed0000-0000-4000-8000-000000000001','seed-visitor-21','민트','오늘도 방에서 잘 쉬었어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+708*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000021','5eed0000-0000-4000-8000-000000000001','seed-visitor-22','포도','긴 글도 줄바꿈이 잘 보이는지 확인해 볼게요.
두 번째 줄입니다.
세 번째 줄입니다.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+745*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000022','5eed0000-0000-4000-8000-000000000001','seed-visitor-23','🐾','마지막 댓글입니다.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+782*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000023','5eed0000-0000-4000-8000-000000000001','seed-visitor-24','해바라기','스물세 번째 댓글, 더 보기 확인용이에요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-0*60000+819*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000024','5eed0000-0000-4000-8000-000000000002','seed-visitor-06','솔','저는 숲 소리가 제일 기대돼요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-40*60000+90*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000025','5eed0000-0000-4000-8000-000000000002','seed-visitor-07','','무음일 때 꺼지는 부분 꼭 같이 부탁해요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-40*60000+150*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000026','5eed0000-0000-4000-8000-000000000003','seed-visitor-08','별','5분 더 버튼 덕분에 흐름이 안 끊겨서 좋아요!',CAST(unixepoch('subsec')*1000 AS INTEGER)-2*86400000-5*60000+60*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000027','5eed0000-0000-4000-8000-000000000004','seed-visitor-09','파도','홈 화면 위젯이면 잠금 화면에서도 보였으면 해요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-2*86400000-300*60000+100*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000028','5eed0000-0000-4000-8000-000000000006','seed-visitor-10','리라','토끼 풀밭 아이디어 좋아요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-4*86400000-15*60000+45*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000029','5eed0000-0000-4000-8000-000000000010','seed-visitor-11','하나','공유 링크는 언제든 끌 수 있어야 할 것 같아요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-8*86400000-30*60000+80*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000030','5eed0000-0000-4000-8000-000000000013','seed-visitor-12','봄','저도 아이콘 바꾸고 싶었어요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-12*86400000-45*60000+30*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000031','5eed0000-0000-4000-8000-000000000013','seed-visitor-13','사과','이제 되네요, 고맙습니다.',CAST(unixepoch('subsec')*1000 AS INTEGER)-12*86400000-45*60000+9000*60000,0,0,lower(hex(randomblob(16)))),
('5eed0001-0000-4000-8000-000000000032','5eed0000-0000-4000-8000-000000000002','seed-visitor-14','숨김','LOCAL TEST: hidden comment, must not show or count.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-40*60000+70*60000,1,0,lower(hex(randomblob(16))));

INSERT INTO comments(id,idea_id,visitor_id,nickname,body,created_at,hidden,is_operator,client_request_id) VALUES
('5eed0002-0000-4000-8000-000000000001','5eed0000-0000-4000-8000-000000000002',NULL,'My Animal Room','의견 감사합니다. 방마다 소리를 다르게 하는 방향으로 준비하고 있어요. 방 분위기에 맞는 소리부터 하나씩 만들어 볼게요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-1*86400000-40*60000+300*60000,0,1,lower(hex(randomblob(16)))),
('5eed0002-0000-4000-8000-000000000002','5eed0000-0000-4000-8000-000000000003',NULL,'My Animal Room','말씀해 주셔서 감사합니다. 집중 흐름이 끊기지 않도록 5분 연장 버튼을 추가했어요. 다음 업데이트에서 만나요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-2*86400000-5*60000+2000*60000,0,1,lower(hex(randomblob(16)))),
('5eed0002-0000-4000-8000-000000000003','5eed0000-0000-4000-8000-000000000007',NULL,'My Animal Room','밤 모드 연출은 방 분위기와 함께 다듬어서 준비 중이에요. 완성되면 소식으로 알려 드릴게요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-5*86400000-200*60000+500*60000,0,1,lower(hex(randomblob(16)))),
('5eed0002-0000-4000-8000-000000000004','5eed0000-0000-4000-8000-000000000013',NULL,'My Animal Room','앱 아이콘 선택을 추가했어요. 업데이트 후에도 아이콘이 바뀌지 않으면 앱을 한 번 완전히 종료한 뒤 다시 열어 주세요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-12*86400000-45*60000+2500*60000,0,1,lower(hex(randomblob(16)))),
('5eed0002-0000-4000-8000-000000000005','5eed0000-0000-4000-8000-000000000013',NULL,'My Animal Room','아이콘이 바로 바뀌지 않던 문제도 고쳤어요. 자세한 내용은 새 소식을 확인해 주세요. /news/#feedback-board',CAST(unixepoch('subsec')*1000 AS INTEGER)-12*86400000-45*60000+2600*60000,0,1,lower(hex(randomblob(16)))),
('5eed0002-0000-4000-8000-000000000006','5eed0000-0000-4000-8000-000000000018',NULL,'My Animal Room','요일별 목표는 설계를 시작했어요. 구체적인 방식이 정해지면 다시 알려 드릴게요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-19*86400000-35*60000+400*60000,0,1,lower(hex(randomblob(16)))),
('5eed0002-0000-4000-8000-000000000007','5eed0000-0000-4000-8000-000000000021',NULL,'My Animal Room','기기 안에만 저장되는 점을 좋게 봐 주셔서 감사합니다. 백업 안내는 설명을 더 쉽게 고쳐 볼게요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-26*86400000-15*60000+3000*60000,0,1,lower(hex(randomblob(16)))),
('5eed0002-0000-4000-8000-000000000008','5eed0000-0000-4000-8000-000000000015',NULL,'My Animal Room','식물 성장 기록은 검토 중이에요. 주간 모아보기 의견도 함께 참고할게요.',CAST(unixepoch('subsec')*1000 AS INTEGER)-14*86400000-120*60000+800*60000,0,1,lower(hex(randomblob(16))));
