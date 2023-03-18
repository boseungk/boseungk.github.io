---
layout: post
title: 신고 결과 받기
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 신고 결과 받기 - 프로그래머스

### 문제
[신고 결과 받기](https://school.programmers.co.kr/learn/courses/30/lessons/92334)

### 해설
* 처음 풀었을 때, 수월하게 풀었는데 생각보다 정답률이 낮은 문제라서 다시 사고를 복기해보았다.
  * 문제를 요약하자면 닉네임과 신고 횟수가 대응되는 딕셔너리와 닉네임과 리스트가 대응되는 딕셔너리 두개를 연결시켜서 횟수를 반환하는 구조다.
  * 나는 처음부터 구조를 그리면서 접근해서 나름 수월하게 전체 구조를 파악할 수 있었던 것 같다.
* 다른 풀이를 참고한 후 리팩토링을 해보았다.
  * 한 유저가 신고한 횟수는 중복으로 처리해서 set을 활용하는 것이 좋다.
  * 숫자만을 반환하면 되기 때문에 조건으로 사용할 신고당한 횟수를 정리한 딕셔너리만으로 바로 result에 신고 리포트 횟수를 대응시켜보았다.
  * 대응 시키는 부분에서 고민을 꽤 했는데, 리스트의 데이터들이 인덱스를 통해 순서를 가지고 있다는 점을 이용해서 대응시켰다.(이 부분이 문제의 포인트인듯)
  * 확실히 무거운 리스트 딕셔너리와 for문을 제거하니까 시간복잡도가 눈에 띄게 줄어들었다.(O(n2)-> O(n))
### 1. 처음 풀이
```python
import collections
def solution(id_list, report, k):
    maps = dict()
    counter = collections.Counter()
    for key in id_list:
        maps[key] = []
    for r in report:
        key, value = r.split()[0], r.split()[1]
        if value in maps[key]:
            continue
        counter[value] += 1
        maps[key] += [value]
    result = []
    for name in maps:
        cnt = 0
        for key in counter:
            if counter[key] >= k and key in maps[name]:
                cnt += 1
        result.append(cnt)
    return result
```

### 2. 리팩토링한 풀이
```python
def solution(id_list, report, k):
    counter = {}
    result = [0] * len(id_list)
    for n in id_list:
        counter[n] = 0
    for r in set(report):
        counter[r.split()[1]] += 1 # 신고당한 횟수
    for r in set(report):
        i = id_list.index(r.split()[0]) # result 위치 찾기
        if counter[r.split()[1]] >= k: # 조건으로 거르기
            result[i] += 1
    return result
```