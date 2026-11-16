Traceback (most recent call last):
File "/lib/python3.12/site-packages/pandas/core/indexes/base.py", line 3805, in get_loc
return self.\_engine.get_loc(casted_key)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
File "index.pyx", line 167, in pandas.\_libs.index.IndexEngine.get_loc
File "index.pyx", line 196, in pandas.\_libs.index.IndexEngine.get_loc
File "pandas/\_libs/hashtable_class_helper.pxi", line 7081, in pandas.\_libs.hashtable.PyObjectHashTable.get_item
File "pandas/\_libs/hashtable_class_helper.pxi", line 7089, in pandas.\_libs.hashtable.PyObjectHashTable.get_item
KeyError: 0

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
File "<exec>", line 603, in **tabula_run**
File "<input>", line 72, in <module>
File "<exec>", line 437, in \_safe_df_getitem
File "/lib/python3.12/site-packages/pandas/core/frame.py", line 4102, in **getitem**
indexer = self.columns.get_loc(key)
^^^^^^^^^^^^^^^^^^^^^^^^^
File "/lib/python3.12/site-packages/pandas/core/indexes/base.py", line 3812, in get_loc
raise KeyError(key) from err
KeyError: 0
\_\_
There is a new error, so you can fix that one. I want it like this: when I say "generate an executive summary" or "make a report," it should be able to write a summary about the data, then generate the results on the table or the figures, then talk about it, then generate another piece of data, then talk about it in conclusion. Right now, it generates the figure, then on top of that figure is the bottom, and the report is keep writing above the figures, which is a little bit inconsistent by standard. Also, make sure that it never throws errors, especially on production. It should not show users technical terms as well, like Python or SQL or DuckDB, because we treat users as people that have no knowledge of computers, which is why we developed this app for them to understand the data more properly. Just keep going, make sure that the code is robust.
