---
layout: post
title: 쿠키 부여
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 쿠키부여 - leetcode 455번

### 문제
[455. Assign Cookies](https://leetcode.com/problems/assign-cookies/description/)

### 해설
1. for문을 2번 써야 할때 + 정렬해서 풀 수 있을때 -> 투포인터 풀이
2. 투포인터 풀이 Tip
   1. 문제 조건 주어진 조건 기준으로 만족하지 못하면 다른 포인터 인덱스에 +1 
   2. if문 / while문을 적절히 활용

```python
class Solution:
    def findContentChildren(self, g: List[int], s: List[int]) -> int:
        g.sort()
        s.sort()
        cnt, index_g, index_s = 0, 0, 0
        while index_g < len(g) and index_s < len(s):
            if s[index_s] >= g[index_g]:
                index_g += 1
                cnt += 1
            index_s += 1
        return cnt    
        # 1. for보다 while이 적절할때: 제한조건을 섞어서 사용해야할때
```