---
layout: post
title: 전화 번호 문자 조합
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 전화 번호 문자 조합 - leetcode 12번

### 문제
[17. Letter Combinations of a Phone Number](https://leetcode.com/problems/letter-combinations-of-a-phone-number/)

입력: "23"

출력: ['ad', 'ae', 'af', 'bd', 'be', 'bf', 'cd', 'ce', 'cf']

### 해설
1. dfs(시작노드, str)로 시작
2. dfs 정의는 for문으로 재귀적으로 다음 노드를 탐색할 수 있도록 호출 + 문자열 누적(노드 방문)
   1. index가 커지는건 방문한 노드를 기록하는 역할, len(digits)는 방문할 노드의 총 개수
3. 문자열의 길이로 dfs 종료 후 result에 최종 결과 추가
### 풀이
```python
class Solution:
    def solution(self, digits: str) -> list[str]:
        def dfs(index, path):
            if len(path) == len(digits):
                return result.append(path)
            for i in range(index, len(digits)):
                for j in dic[digits[i]]:
                    dfs(i+1, path+j)

        dic = {"2": "abc", "3": "def", "4": "ghi", "5": "jkl", "6": "mno",
               "7": "pars", "8": "tuv", "9": "wxyz"}
        result = []
        dfs(0, "")

        return result
s = "23"
result = Solution().solution(s)
print(result)


```