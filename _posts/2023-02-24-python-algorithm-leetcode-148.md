---
layout: post
title: 리스트 정렬
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 리스트 정렬 - leetcode 148번

### 문제
[148. Sort List](https://leetcode.com/problems/sort-list/)

### 해설(분할정복)
```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class Solution:
    def mergeTwoLists(self, l1, l2):
        if l1 and l2:
            if l1.val > l2.val:
                l1, l2 = l2, l1
        l1.next = self.mergeTwoLists(l1.next, l2)
        # 6. l1.next가 있으면(l1.next가 연결되어 있으면) 계속 대소 비교해서 재정렬
        return l1 or l2
        # 7. 재귀적으로 비교 후 작은 값을 l1.next와 연결하기 위해서 l1 리턴
        # 8. 만약 l1 없으면 l2를 리턴해서 l1.next와 연결

    def solution(self, head) -> int:
        if head and head.next:
            return head
        half, slow, fast = None, head, head
        while fast and fast.next:
            half, slow, fast = slow, slow.next, fast.next.next
            # 1. 러너로 half, slow, fast로 중간 바로 전, 중간, 끝 포인터 구하기
        half.next = None
        # 2. half를 head로 하지 않은 이유는 head는 root로 쓰려고
        # 3. half랑 slow를 끊기 위해서, 최종적으로 head == half // 분할정복에서 분할
        l1 = self.solution(head)
        l2 = self.solution(slow)
        # 4. 재귀적으로 위에서부터 차례로 하나로 분할
        return self.mergeTwoLists(l1, l2)
        # 5. 스택이랑 비슷하게 각각을 분할정복 시작


root = ListNode(-1)
root.next = ListNode(5)
root.next.next = ListNode(3)
root.next.next.next = ListNode(4)
root.next.next.next.next = ListNode(0)

result = Solution().solution(root)
print(result.val)
```