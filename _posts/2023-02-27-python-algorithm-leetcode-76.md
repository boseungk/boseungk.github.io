---
layout: post
title: 부분 문자열이 포함된 최소 윈도우
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 부분 문자열이 포함된 최소 윈도우 - leetcode 76번

### 문제
[76. Minimum Window Substring](https://leetcode.com/problems/minimum-window-substring/)

### 해설
1. 문자열 기준으로 특정 조건을 만족할때마다 문자열 추출
   1. 특정 길이이므로 투 포인터 아이디어 떠올리기
   2. 문자개수를 count 해야하므로 Counter함수 사용하는것이 편리함 + 조건의 문자열의 길이 == 0
   3. 여기서 defaultdic를 이용하면 조건에 있는 문자는 1 이상이고 조건에 없는 문자는 0 이하이므로 이 조건을 이용해서 카운트
   4. 카운트 후 Counter에서 -1 해서 차감하기
2. 특정 조건을 만족했을때, 투포인터 사이즈 줄이기
   1. left를 증가시키면서 투포인터 사이즈를 줄여야 함
   2. left를 증가시키면서 -1해준 값들을 복구 시켜야 함(그래야 미래 찾는 문자들에 영향을 안 미침)
   3. left를 증가시키면서 Counter가 0인 지점까지 줄여주면 됨
3. 투 포인터의 인덱스 길이 비교해서 최소값 최종적으로 리턴하기
```python
    def solution(self, s, t):
        counter = collections.Counter(t)
        target_len = len(t)
        left = start = end = 0

        for right, char in enumerate(s):
            target_len -= counter[char] > 0
            counter[char] -= 1
            if target_len == 0:
                while left < right and counter[s[left]] < 0:
                    counter[s[left]] += 1
                    left += 1
                if not end or right - left <= end - start:
                    end, start = right, left
                    counter[s[left]] += 1
                    left += 1
                    target_len += 1
        return s[start:end + 1]
```