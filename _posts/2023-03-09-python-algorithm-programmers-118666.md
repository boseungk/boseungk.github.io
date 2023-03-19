---
layout: post
title: 성격 유형 검사하기
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 성격 유형 검사하기 - 프로그래머스

### 문제
[성격 유형 검사하기](https://school.programmers.co.kr/learn/courses/30/lessons/118666)

### 해설 
* '은 총알은 없다(No Silver Bullet)' 라더니 defaultdict를 사용하다가 예외처리에 당황했다.
* 결국 딕셔너리에 초기값을 0으로 정해서 시작해야하는 것을 깨달았다.. 
* defauldict도 상황에 맞게 잘 사용해야 할 것 같다.
* 문제 조건을 그대로 가져가는 대신 +/- 가중치로 해석, 한 줄 if/else로 깔끔하고 좋은 풀이인 것 같다.

### 풀이 1(예외처리에 실패한 처음 풀이)
```python
    def solution(self, survey, choices):
        dic = collections.defaultdict(int)
        for i in 
        def char_weight(char, weight):
            if weight < 4:
                dic[char[0]] += 4 - weight
            elif weight > 4:
                dic[char[1]] += weight - 4
            else:
                dic[char[0]] += 0
                dic[char[1]] += 0

        for i in range(len(survey)):
            char_weight(survey[i], choices[i])
        result = []
        s = ""
        keys = list(dic.keys())
        for key in keys:
            if key == "R" and dic[key] >= dic["T"]:
                result.append((0, "R"))
            elif key == "T" and dic[key] > dic["R"]:
                result.append((0, "T"))
            if key == "C" and dic[key] >= dic["F"]:
                result.append((1, "C"))
            elif key == "F" and dic[key] > dic["C"]:
                result.append((1, "F"))
            if key == "J" and dic[key] >= dic["M"]:
                result.append((2, "J"))
            elif key == "M" and dic[key] > dic["J"]:
                result.append((2, "M"))
            if key == "A" and dic[key] >= dic["N"]:
                result.append((3, "A"))
            elif key == "N" and dic[key] > dic["A"]:
                result.append((3, "N"))
        for i in sorted(result, key=lambda x: x[0]):
            s += i[1]
        return s
```
### 풀이 2(테스트 케이스 통과한 풀이)
```python
import collections
def solution(survey, choices):
    scores = {
        "RT": 0,
        "CF": 0,
        "JM": 0,
        "AN": 0
    }
    for i in range(len(survey)):
        c = survey[i][0]
        survey[i] = "".join(sorted(survey[i])) # 정렬된 문자로 일관된 기준
        weight = choices[i] - 4 # 음수이거나 0이면 [0], 양수이면 [1]의 점수
        if survey[i][0] != c:
            weight = -weight
        if weight <= 0:
            scores[survey[i]] += weight
        else:
            scores[survey[i]] += weight 
        print(survey[i], ":", weight)
    result = ""
    for char in scores.keys():
        if scores[char] > 0:
            result += char[1]
        else:
            result += char[0]
    return result

```

### 풀이 3(다른 사람 풀이)
```python
def solution(survey, choices):
    answer = ''

    scores = {"R":0,"T":0,"C":0,"F":0,"J":0,"M":0,"A":0,"N":0 }
    add_score = {1:3, 2:2, 3:1, 4:0, 5:-1, 6:-2, 7:-3}

    for i in range(len(survey)):
        scores[survey[i][0]] += add_score[choices[i]]

    answer += "R" if scores["R"] >= scores["T"] else "T"
    answer += "C" if scores["C"] >= scores["F"] else "F"
    answer += "J" if scores["J"] >= scores["M"] else "M"
    answer += "A" if scores["A"] >= scores["N"] else "N"
    
    return answer
```