---
layout: post
title: 중복 문자 제거
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 중복 문자 제거 - leetcode 316번

### 문제

[316. Remove Duplicate Letters](https://leetcode.com/problems/remove-duplicate-letters/)

입력: "bcabc"

출력: "abc"

### 해설 1 (반복)
1. 앞에서부터 중복된 문자는 제거하면서 사전식 순서로 쌓아감
   1. 중복된 문자 제거를 앞 뒤로 비교하기 위해서는 Counter함수 사용하는게 좋음
   2. 문자열은 쌓아가면서 중복은 제거할때 스택 사용하는것도 괜찮음(사실 리스트..)
2. for문으로 문자열을 탐색하기 시작
3. 일단 스택에다가 쌓으면서 비교 대상의 단어와 스택에 쌓인 단어가 사전식 / 중복인지 비교
   1. 중복이거나 사전식으로 쌓인게 아니면 while문으로 전부 stack 제거
4. stack에 쌓인 단어 리턴

```python
class Solution:
    def solution(self, s: str):
        stack, counter = [], collections.Counter(s)
        # 중복 확인 후 있으면 사전식 비교
        for char in s:
            counter[char] -= 1
            if char in stack: continue
            while stack and char < stack[-1] and counter[stack[-1]] > 0:
                stack.pop()
            stack.append(char)
        return ''.join(stack)

s = "bcabc" # cbacdcbc

answer = Solution().solution(s)
print(answer)
```