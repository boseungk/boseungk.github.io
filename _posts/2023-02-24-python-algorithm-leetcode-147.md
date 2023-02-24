---
layout: post
title: 삽입 정렬 리스트
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 삽입 정렬 리스트 - leetcode 147번

### 문제
[147. Insertion Sort List](https://leetcode.com/problems/insertion-sort-list/)

### 해설
```python

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class Solution:
    def solution(self, head):
        cur = parent = ListNode()
        # 1. parent는 root로 사용하고 cur를 이용해서 조작 예정
        while head:
            while cur.next and cur.next.val < head.val:
                cur = cur.next
            # 3. 정렬기준
            # 3-1. cur 앞에 넣기 위해서 cur.next으로 head.val이랑 비교
            # 3-2. 연결리스트 특성 상 매번 초기화 후 넣을 위치까지 재이동해야 함
            cur.next, head.next, head = head, cur.next, head.next
            # 2. cur에 삽입하면서 정렬, 리스트 서로 연결 시켜주기 + head 다음으로 이동시키기
            if head and cur.val > head.val:
                cur = parent
            # 3-3. cur 초기화 + 최적화 위해서 필요할떄만 초기화
        return parent.next

root = ListNode(4)
root.next = ListNode(2)
root.next.next = ListNode(1)
root.next.next.next = ListNode(3)

result = Solution().solution(root)
print(result.val)
```